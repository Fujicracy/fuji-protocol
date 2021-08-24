// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./abstracts/claimable/Claimable.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IVaultControl.sol";
import "./interfaces/IFujiAdmin.sol";
import "./interfaces/IFujiOracle.sol";
import "./interfaces/IFujiERC1155.sol";
import "./interfaces/IERC20Extended.sol";
import "./flashloans/Flasher.sol";
import "./libraries/LibUniversalERC20.sol";
import "./libraries/FlashLoans.sol";
import "./libraries/Errors.sol";

contract Fliquidator is Claimable, ReentrancyGuard {
  using SafeERC20 for IERC20;
  using LibUniversalERC20 for IERC20;

  address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  // slippage limit to 2%
  uint256 public constant SLIPPAGE_LIMIT_NUMERATOR = 2;
  uint256 public constant SLIPPAGE_LIMIT_DENOMINATOR = 100;

  struct Factor {
    uint64 a;
    uint64 b;
  }

  // Flash Close Fee Factor
  Factor public flashCloseF;

  IFujiAdmin private _fujiAdmin;
  IFujiOracle private _oracle;
  IUniswapV2Router02 public swapper;

  // Log Liquidation
  event Liquidate(
    address indexed userAddr,
    address indexed vault,
    uint256 amount,
    address liquidator
  );
  // Log FlashClose
  event FlashClose(address indexed userAddr, address indexed vault, uint256 amount);

  modifier isAuthorized() {
    require(msg.sender == owner(), Errors.VL_NOT_AUTHORIZED);
    _;
  }

  modifier onlyFlash() {
    require(msg.sender == _fujiAdmin.getFlasher(), Errors.VL_NOT_AUTHORIZED);
    _;
  }

  modifier isValidVault(address _vaultAddr) {
    require(_fujiAdmin.validVault(_vaultAddr), "Invalid vault!");
    _;
  }

  constructor() {
    // 1.013
    flashCloseF.a = 1013;
    flashCloseF.b = 1000;
  }

  receive() external payable {}

  // FLiquidator Core Functions

  /**
   * @dev Liquidate an undercollaterized debt and get bonus (bonusL in Vault)
   * @param _userAddrs: Address array of users whose position is liquidatable
   * @param _vault: Address of the vault in where liquidation will occur
   * Emits a {Liquidate} event.
   */
  function batchLiquidate(address[] calldata _userAddrs, address _vault)
    external
    payable
    nonReentrant
    isValidVault(_vault)
  {
    IVault(_vault).updateF1155Balances();

    // Struct Instance to get Vault Asset IDs in f1155
    IVaultControl.VaultAssets memory vAssets = IVaultControl(_vault).vAssets();

    (address[] memory addrs, uint256[] memory borrowBals, uint256 debtTotal) = _constructParams(
      _userAddrs,
      _vault
    );

    // Check there is at least one user liquidatable
    require(debtTotal > 0, Errors.VL_USER_NOT_LIQUIDATABLE);

    if (vAssets.borrowAsset == ETH) {
      require(msg.value >= debtTotal, Errors.VL_AMOUNT_ERROR);
    } else {
      // Check Liquidator Allowance
      require(
        IERC20(vAssets.borrowAsset).allowance(msg.sender, address(this)) >= debtTotal,
        Errors.VL_MISSING_ERC20_ALLOWANCE
      );

      // Transfer borrowAsset funds from the Liquidator to Vault
      IERC20(vAssets.borrowAsset).safeTransferFrom(msg.sender, _vault, debtTotal);
    }

    // Repay BaseProtocol debt
    uint256 _value = vAssets.borrowAsset == ETH ? debtTotal : 0;
    IVault(_vault).paybackLiq{ value: _value }(int256(debtTotal));

    // Compute liquidator's bonus: bonusL
    uint256 bonus = IVault(_vault).getLiquidationBonusFor(debtTotal, false);
    // Compute how much collateral needs to be swapt
    uint256 collateralInPlay = _getCollateralInPlay(
      vAssets.collateralAsset,
      vAssets.borrowAsset,
      debtTotal + bonus
    );

    // Withdraw collateral
    IVault(_vault).withdrawLiq(int256(collateralInPlay));

    // Swap Collateral
    _swap(
      vAssets.collateralAsset,
      vAssets.borrowAsset,
      debtTotal + bonus,
      collateralInPlay,
      true
    );

    // Burn f1155
    _burnMulti(addrs, borrowBals, _vault);

    // Transfer to Liquidator the debtBalance + bonus
    IERC20(vAssets.borrowAsset).univTransfer(payable(msg.sender), debtTotal + bonus);

    // Emit liquidation event for each liquidated user
    for (uint256 i = 0; i < addrs.length; i += 1) {
      if (addrs[i] != address(0)) {
        emit Liquidate(addrs[i], _vault, borrowBals[i], msg.sender);
      }
    }
  }

  /**
   * @dev Initiates a flashloan to liquidate array of undercollaterized debt positions,
   * gets bonus (bonusFlashL in Vault)
   * @param _userAddrs: Array of Address whose position is liquidatable
   * @param _vault: The vault address where the debt position exist.
   * @param _flashnum: integer identifier of flashloan provider
   * Emits a {Liquidate} event.
   */
  function flashBatchLiquidate(
    address[] calldata _userAddrs,
    address _vault,
    uint8 _flashnum
  ) external isValidVault(_vault) nonReentrant {
    IVault(_vault).updateF1155Balances();

    // Struct Instance to get Vault Asset IDs in f1155
    IVaultControl.VaultAssets memory vAssets = IVaultControl(_vault).vAssets();

    (address[] memory addrs, uint256[] memory borrowBals, uint256 debtTotal) = _constructParams(
      _userAddrs,
      _vault
    );

    // Check there is at least one user liquidatable
    require(debtTotal > 0, Errors.VL_USER_NOT_LIQUIDATABLE);

    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.BatchLiquidate,
      asset: vAssets.borrowAsset,
      amount: debtTotal,
      vault: _vault,
      newProvider: address(0),
      userAddrs: addrs,
      userBalances: borrowBals,
      userliquidator: msg.sender,
      fliquidator: address(this)
    });

    Flasher(payable(_fujiAdmin.getFlasher())).initiateFlashloan(info, _flashnum);
  }

  /**
   * @dev Liquidate a debt position by using a flashloan
   * @param _userAddrs: array **See addrs construction in 'function flashBatchLiquidate'
   * @param _borrowBals: array **See construction in 'function flashBatchLiquidate'
   * @param _liquidator: liquidator address
   * @param _vault: Vault address
   * @param _amount: amount of debt to be repaid
   * @param _flashloanFee: amount extra charged by flashloan provider
   * Emits a {Liquidate} event.
   */
  function executeFlashBatchLiquidation(
    address[] calldata _userAddrs,
    uint256[] calldata _borrowBals,
    address _liquidator,
    address _vault,
    uint256 _amount,
    uint256 _flashloanFee
  ) external payable onlyFlash {
    // Struct Instance to get Vault Asset IDs in f1155
    IVaultControl.VaultAssets memory vAssets = IVaultControl(_vault).vAssets();

    // Repay BaseProtocol debt to release collateral
    uint256 _value = vAssets.borrowAsset == ETH ? _amount : 0;
    IVault(_vault).paybackLiq{ value: _value }(int256(_amount));

    // Compute liquidator's bonus: bonusFlashL
    uint256 bonus = IVault(_vault).getLiquidationBonusFor(_amount, true);

    // Compute how much collateral needs to be swapt for all liquidated users
    uint256 collateralInPlay = _getCollateralInPlay(
      vAssets.collateralAsset,
      vAssets.borrowAsset,
      _amount + _flashloanFee + bonus
    );

    // Withdraw collateral
    IVault(_vault).withdrawLiq(int256(collateralInPlay));

    _swap(
      vAssets.collateralAsset,
      vAssets.borrowAsset,
      _amount + _flashloanFee + bonus,
      collateralInPlay,
      true
    );

    // Burn f1155
    _burnMulti(_userAddrs, _borrowBals, _vault);

    // Send flasher the underlying to repay Flashloan
    IERC20(vAssets.borrowAsset).univTransfer(
      payable(_fujiAdmin.getFlasher()),
      _amount + _flashloanFee
    );

    // Transfer Bonus bonusFlashL to liquidator, minus FlashloanFee convenience
    IERC20(vAssets.borrowAsset).univTransfer(payable(_liquidator), bonus - _flashloanFee);

    // Emit liquidation event for each liquidated user
    for (uint256 i = 0; i < _userAddrs.length; i += 1) {
      if (_userAddrs[i] != address(0)) {
        emit Liquidate(_userAddrs[i], _vault, _borrowBals[i], _liquidator);
      }
    }
  }

  /**
   * @dev Initiates a flashloan used to repay partially or fully the debt position of msg.sender
   * @param _amount: Pass -1 to fully close debt position, otherwise Amount to be repaid with a flashloan
   * @param _vault: The vault address where the debt position exist.
   * @param _flashnum: integer identifier of flashloan provider
   */
  function flashClose(
    int256 _amount,
    address _vault,
    uint8 _flashnum
  ) external nonReentrant isValidVault(_vault) {
    // Update Balances at FujiERC1155
    IVault(_vault).updateF1155Balances();

    // Create Instance of FujiERC1155
    IFujiERC1155 f1155 = IFujiERC1155(IVault(_vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in f1155
    IVaultControl.VaultAssets memory vAssets = IVaultControl(_vault).vAssets();

    // Get user  Balances
    uint256 userCollateral = f1155.balanceOf(msg.sender, vAssets.collateralID);
    uint256 userDebtBalance = f1155.balanceOf(msg.sender, vAssets.borrowID);

    require(userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);

    uint256 amount = _amount < 0 ? userDebtBalance : uint256(_amount);

    uint256 neededCollateral = IVault(_vault).getNeededCollateralFor(amount, false);
    require(userCollateral >= neededCollateral, Errors.VL_UNDERCOLLATERIZED_ERROR);

    address[] memory userAddressArray = new address[](1);
    userAddressArray[0] = msg.sender;

    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.Close,
      asset: vAssets.borrowAsset,
      amount: amount,
      vault: _vault,
      newProvider: address(0),
      userAddrs: userAddressArray,
      userBalances: new uint256[](0),
      userliquidator: address(0),
      fliquidator: address(this)
    });

    Flasher(payable(_fujiAdmin.getFlasher())).initiateFlashloan(info, _flashnum);
  }

  /**
   * @dev Close user's debt position by using a flashloan
   * @param _userAddr: user addr to be liquidated
   * @param _vault: Vault address
   * @param _amount: amount received by Flashloan
   * @param _flashloanFee: amount extra charged by flashloan provider
   * Emits a {FlashClose} event.
   */
  function executeFlashClose(
    address payable _userAddr,
    address _vault,
    uint256 _amount,
    uint256 _flashloanFee
  ) external payable onlyFlash {
    // Create Instance of FujiERC1155
    IFujiERC1155 f1155 = IFujiERC1155(IVault(_vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in f1155
    IVaultControl.VaultAssets memory vAssets = IVaultControl(_vault).vAssets();

    // Get user Collateral and Debt Balances
    uint256 userCollateral = f1155.balanceOf(_userAddr, vAssets.collateralID);
    uint256 userDebtBalance = f1155.balanceOf(_userAddr, vAssets.borrowID);

    // Get user Collateral + Flash Close Fee to close posisition, for _amount passed
    uint256 userCollateralInPlay = (IVault(_vault).getNeededCollateralFor(
      _amount + _flashloanFee,
      false
    ) * flashCloseF.a) / flashCloseF.b;

    // Repay BaseProtocol debt
    uint256 _value = vAssets.borrowAsset == ETH ? _amount : 0;
    IVault(_vault).paybackLiq{ value: _value }(int256(_amount));

    // Full close
    if (_amount == userDebtBalance) {
      f1155.burn(_userAddr, vAssets.collateralID, userCollateral);

      // Withdraw Full collateral
      IVault(_vault).withdrawLiq(int256(userCollateral));

      // Send unUsed Collateral to User
      IERC20(vAssets.collateralAsset).univTransfer(
        _userAddr,
        userCollateral - userCollateralInPlay
      );
    } else {
      f1155.burn(_userAddr, vAssets.collateralID, userCollateralInPlay);

      // Withdraw Collateral in play Only
      IVault(_vault).withdrawLiq(int256(userCollateralInPlay));
    }

    // Swap Collateral for underlying to repay Flashloan
    uint256 remaining = _swap(
      vAssets.collateralAsset,
      vAssets.borrowAsset,
      _amount + _flashloanFee,
      userCollateralInPlay,
      false
    );

    // Send FlashClose Fee to FujiTreasury
    IERC20(vAssets.collateralAsset).univTransfer(_fujiAdmin.getTreasury(), remaining);

    // Send flasher the underlying to repay Flashloan
    IERC20(vAssets.borrowAsset).univTransfer(
      payable(_fujiAdmin.getFlasher()),
      _amount + _flashloanFee
    );

    // Burn Debt f1155 tokens
    f1155.burn(_userAddr, vAssets.borrowID, _amount);

    emit FlashClose(_userAddr, _vault, userDebtBalance);
  }

  /**
   * @dev Swap an amount of underlying
   * @param _collateralAsset: Address of vault collateralAsset
   * @param _borrowAsset: Address of vault borrowAsset
   * @param _amountToReceive: amount of underlying to receive
   * @param _collateralAmount: collateral Amount sent for swap
   */
  function _swap(
    address _collateralAsset,
    address _borrowAsset,
    uint256 _amountToReceive,
    uint256 _collateralAmount,
    bool _checkSlippage
  ) internal returns (uint256) {
    if (_checkSlippage) {
      uint8 _collateralAssetDecimals;
      uint8 _borrowAssetDecimals;
      if (_collateralAsset == ETH) {
        _collateralAssetDecimals = 18;
      } else {
        _collateralAssetDecimals = IERC20Extended(_collateralAsset).decimals();
      }
      if (_borrowAsset == ETH) {
        _borrowAssetDecimals = 18;
      } else {
        _borrowAssetDecimals = IERC20Extended(_borrowAsset).decimals();
      }

      uint256 priceFromSwapper = (_collateralAmount * (10**uint256(_borrowAssetDecimals))) /
        _amountToReceive;
      uint256 priceFromOracle = _oracle.getPriceOf(
        _collateralAsset,
        _borrowAsset,
        _collateralAssetDecimals
      );
      uint256 priceDelta = priceFromSwapper > priceFromOracle
        ? priceFromSwapper - priceFromOracle
        : priceFromOracle - priceFromSwapper;

      require(
        (priceDelta * SLIPPAGE_LIMIT_DENOMINATOR) / priceFromOracle < SLIPPAGE_LIMIT_NUMERATOR,
        Errors.VL_SWAP_SLIPPAGE_LIMIT_EXCEED
      );
    }

    // Swap Collateral Asset to Borrow Asset
    address weth = swapper.WETH();
    address[] memory path;
    uint256[] memory swapperAmounts;

    if (_collateralAsset == ETH) {
      path = new address[](2);
      path[0] = weth;
      path[1] = _borrowAsset;

      swapperAmounts = swapper.swapETHForExactTokens{ value: _collateralAmount }(
        _amountToReceive,
        path,
        address(this),
        // solhint-disable-next-line
        block.timestamp
      );
    } else if (_borrowAsset == ETH) {
      path = new address[](2);
      path[0] = _collateralAsset;
      path[1] = weth;

      IERC20(_collateralAsset).univApprove(address(swapper), _collateralAmount);
      swapperAmounts = swapper.swapTokensForExactETH(
        _amountToReceive,
        _collateralAmount,
        path,
        address(this),
        // solhint-disable-next-line
        block.timestamp
      );
    } else {
      if (_collateralAsset == weth || _borrowAsset == weth) {
        path = new address[](2);
        path[0] = _collateralAsset;
        path[1] = _borrowAsset;
      } else {
        path = new address[](3);
        path[0] = _collateralAsset;
        path[1] = weth;
        path[2] = _borrowAsset;
      }

      IERC20(_collateralAsset).univApprove(address(swapper), _collateralAmount);
      swapperAmounts = swapper.swapTokensForExactTokens(
        _amountToReceive,
        _collateralAmount,
        path,
        address(this),
        // solhint-disable-next-line
        block.timestamp
      );
    }

    return _collateralAmount - swapperAmounts[0];
  }

  /**
   * @dev Get exact amount of collateral to be swapt
   * @param _collateralAsset: Address of vault collateralAsset
   * @param _borrowAsset: Address of vault borrowAsset
   * @param _amountToReceive: amount of underlying to receive
   */
  function _getCollateralInPlay(
    address _collateralAsset,
    address _borrowAsset,
    uint256 _amountToReceive
  ) internal view returns (uint256) {
    address weth = swapper.WETH();
    address[] memory path;
    if (_collateralAsset == ETH || _collateralAsset == weth) {
      path = new address[](2);
      path[0] = weth;
      path[1] = _borrowAsset;
    } else if (_borrowAsset == ETH || _borrowAsset == weth) {
      path = new address[](2);
      path[0] = _collateralAsset;
      path[1] = weth;
    } else {
      path = new address[](3);
      path[0] = _collateralAsset;
      path[1] = weth;
      path[2] = _borrowAsset;
    }

    uint256[] memory amounts = swapper.getAmountsIn(_amountToReceive, path);

    return amounts[0];
  }

  function _constructParams(address[] memory _userAddrs, address _vault)
    internal
    view
    returns (
      address[] memory addrs,
      uint256[] memory borrowBals,
      uint256 debtTotal
    )
  {
    address f1155 = IVault(_vault).fujiERC1155();

    IVaultControl.VaultAssets memory vAssets = IVaultControl(_vault).vAssets();

    addrs = new address[](_userAddrs.length);

    uint256[] memory borrowIds = new uint256[](_userAddrs.length);
    uint256[] memory collateralIds = new uint256[](_userAddrs.length);

    // Build the required Arrays to query balanceOfBatch from f1155
    for (uint256 i = 0; i < _userAddrs.length; i += 1) {
      collateralIds[i] = vAssets.collateralID;
      borrowIds[i] = vAssets.borrowID;
    }

    // Get user collateral and debt balances
    borrowBals = IERC1155(f1155).balanceOfBatch(_userAddrs, borrowIds);
    uint256[] memory collateralBals = IERC1155(f1155).balanceOfBatch(_userAddrs, collateralIds);

    uint256 neededCollateral;

    for (uint256 i = 0; i < _userAddrs.length; i += 1) {
      // Compute amount of min collateral required including factors
      neededCollateral = IVault(_vault).getNeededCollateralFor(borrowBals[i], true);

      // Check if User is liquidatable
      if (collateralBals[i] < neededCollateral) {
        // If true, add User debt balance to the total balance to be liquidated
        debtTotal += borrowBals[i];
        addrs[i] = _userAddrs[i];
      } else {
        // set user that is not liquidatable to Zero Address
        addrs[i] = address(0);
      }
    }
  }

  /**
   * @dev Abstracted function to perform MultBatch Burn of Collateral in Batch Liquidation
   * checking bonus paid to liquidator by each
   * See "function executeFlashBatchLiquidation"
   */
  function _burnMulti(
    address[] memory _addrs,
    uint256[] memory _borrowBals,
    address _vault
  ) internal {
    address f1155 = IVault(_vault).fujiERC1155();

    IVaultControl.VaultAssets memory vAssets = IVaultControl(_vault).vAssets();

    uint256 bonusPerUser;
    uint256 collateralInPlayPerUser;

    for (uint256 i = 0; i < _addrs.length; i += 1) {
      if (_addrs[i] != address(0)) {
        bonusPerUser = IVault(_vault).getLiquidationBonusFor(_borrowBals[i], true);

        collateralInPlayPerUser = _getCollateralInPlay(
          vAssets.collateralAsset,
          vAssets.borrowAsset,
          _borrowBals[i] + bonusPerUser
        );

        IFujiERC1155(f1155).burn(_addrs[i], vAssets.borrowID, _borrowBals[i]);
        IFujiERC1155(f1155).burn(_addrs[i], vAssets.collateralID, collateralInPlayPerUser);
      }
    }
  }

  // Administrative functions

  /**
   * @dev Set Factors "a" and "b" for a Struct Factor flashcloseF
   * For flashCloseF;  should be > 1, a/b
   * @param _newFactorA: A number
   * @param _newFactorB: A number
   */
  function setFlashCloseFee(uint64 _newFactorA, uint64 _newFactorB) external isAuthorized {
    flashCloseF.a = _newFactorA;
    flashCloseF.b = _newFactorB;
  }

  /**
   * @dev Sets the fujiAdmin Address
   * @param _newFujiAdmin: FujiAdmin Contract Address
   */
  function setFujiAdmin(address _newFujiAdmin) external isAuthorized {
    _fujiAdmin = IFujiAdmin(_newFujiAdmin);
  }

  /**
   * @dev Changes the Swapper contract address
   * @param _newSwapper: address of new swapper contract
   */
  function setSwapper(address _newSwapper) external isAuthorized {
    swapper = IUniswapV2Router02(_newSwapper);
  }

  /**
   * @dev Changes the Oracle contract address
   * @param _newFujiOracle: address of new oracle contract
   */
  function setFujiOracle(address _newFujiOracle) external isAuthorized {
    _oracle = IFujiOracle(_newFujiOracle);
  }
}
