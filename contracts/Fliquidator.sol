// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IVault } from "./Vaults/IVault.sol";
import { IFujiAdmin } from "./IFujiAdmin.sol";
import { IFujiOracle } from "./IFujiOracle.sol";
import { IFujiERC1155 } from "./FujiERC1155/IFujiERC1155.sol";
import { IERC20Extended } from "./Interfaces/IERC20Extended.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Flasher } from "./Flashloans/Flasher.sol";
import { FlashLoan } from "./Flashloans/LibFlashLoan.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Errors } from "./Libraries/Errors.sol";
import { LibUniversalERC20 } from "./Libraries/LibUniversalERC20.sol";
import { IUniswapV2Router02 } from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IVaultExt is IVault {
  //Asset Struct
  struct VaultAssets {
    address collateralAsset;
    address borrowAsset;
    uint64 collateralID;
    uint64 borrowID;
  }

  function vAssets() external view returns (VaultAssets memory);
}

interface IFujiERC1155Ext is IFujiERC1155 {
  function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
    external
    view
    returns (uint256[] memory);
}

contract Fliquidator is Ownable, ReentrancyGuard {
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
  IFujiOracle private oracle;
  IUniswapV2Router02 public swapper;

  // Log Liquidation
  event Liquidate(
    address indexed userAddr,
    address liquidator,
    address indexed asset,
    uint256 amount
  );
  // Log FlashClose
  event FlashClose(address indexed userAddr, address indexed asset, uint256 amount);
  // Log Liquidation
  event FlashLiquidate(address userAddr, address liquidator, address indexed asset, uint256 amount);

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
   */
  function batchLiquidate(address[] calldata _userAddrs, address _vault)
    external
    nonReentrant
    isValidVault(_vault)
  {
    // Update Balances at FujiERC1155
    IVault(_vault).updateF1155Balances();

    // Create Instance of FujiERC1155
    IFujiERC1155Ext f1155 = IFujiERC1155Ext(IVault(_vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in f1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(_vault).vAssets();

    address[] memory formattedUserAddrs = new address[](2 * _userAddrs.length);
    uint256[] memory formattedIds = new uint256[](2 * _userAddrs.length);

    // Build the required Arrays to query balanceOfBatch from f1155
    for (uint256 i = 0; i < _userAddrs.length; i++) {
      formattedUserAddrs[2 * i] = _userAddrs[i];
      formattedUserAddrs[2 * i + 1] = _userAddrs[i];
      formattedIds[2 * i] = vAssets.collateralID;
      formattedIds[2 * i + 1] = vAssets.borrowID;
    }

    // Get user Collateral and Debt Balances
    uint256[] memory usrsBals = f1155.balanceOfBatch(formattedUserAddrs, formattedIds);

    uint256 neededCollateral;
    uint256 debtBalanceTotal;

    for (uint256 i = 0; i < formattedUserAddrs.length; i += 2) {
      // Compute Amount of Minimum Collateral Required including factors
      neededCollateral = IVault(_vault).getNeededCollateralFor(usrsBals[i + 1], true);

      // Check if User is liquidatable
      if (usrsBals[i] < neededCollateral) {
        // If true, add User debt balance to the total balance to be liquidated
        debtBalanceTotal = debtBalanceTotal + usrsBals[i + 1];
      } else {
        // Replace User that is not liquidatable by Zero Address
        formattedUserAddrs[i] = address(0);
        formattedUserAddrs[i + 1] = address(0);
      }
    }

    // Check there is at least one user liquidatable
    require(debtBalanceTotal > 0, Errors.VL_USER_NOT_LIQUIDATABLE);

    // Check Liquidator Allowance
    require(
      IERC20(vAssets.borrowAsset).allowance(msg.sender, address(this)) >= debtBalanceTotal,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );

    // Transfer borrowAsset funds from the Liquidator to Here
    IERC20(vAssets.borrowAsset).transferFrom(msg.sender, address(this), debtBalanceTotal);

    // Transfer Amount to Vault
    IERC20(vAssets.borrowAsset).univTransfer(payable(_vault), debtBalanceTotal);

    // TODO: Get => corresponding amount of BaseProtocol Debt and FujiDebt

    // Repay BaseProtocol debt
    IVault(_vault).payback(int256(debtBalanceTotal));

    //TODO: Transfer corresponding Debt Amount to Fuji Treasury

    // Compute the Liquidator Bonus bonusL
    uint256 globalBonus = IVault(_vault).getLiquidationBonusFor(debtBalanceTotal, false);
    // Compute how much collateral needs to be swapt
    uint256 globalCollateralInPlay = _getCollateralInPlay(
      vAssets.collateralAsset,
      vAssets.borrowAsset,
      debtBalanceTotal + globalBonus
    );

    // Burn Collateral f1155 tokens for each liquidated user
    _burnMultiLoop(formattedUserAddrs, usrsBals, IVault(_vault), f1155, vAssets);

    // Withdraw collateral
    IVault(_vault).withdraw(int256(globalCollateralInPlay));

    // Swap Collateral
    _swap(
      vAssets.collateralAsset,
      vAssets.borrowAsset,
      debtBalanceTotal + globalBonus,
      globalCollateralInPlay,
      true
    );

    // Transfer to Liquidator the debtBalance + bonus
    IERC20(vAssets.borrowAsset).univTransfer(payable(msg.sender), debtBalanceTotal + globalBonus);

    // Burn Debt f1155 tokens and Emit Liquidation Event for Each Liquidated User
    for (uint256 i = 0; i < formattedUserAddrs.length; i += 2) {
      if (formattedUserAddrs[i] != address(0)) {
        f1155.burn(formattedUserAddrs[i], vAssets.borrowID, usrsBals[i + 1]);
        emit Liquidate(formattedUserAddrs[i], msg.sender, vAssets.borrowAsset, usrsBals[i + 1]);
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
    Flasher flasher = Flasher(payable(_fujiAdmin.getFlasher()));

    // Update Balances at FujiERC1155
    IVault(_vault).updateF1155Balances();

    // Create Instance of FujiERC1155
    IFujiERC1155Ext f1155 = IFujiERC1155Ext(IVault(_vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in f1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(_vault).vAssets();

    // Get user  Balances
    uint256 userCollateral = f1155.balanceOf(msg.sender, vAssets.collateralID);
    uint256 userDebtBalance = f1155.balanceOf(msg.sender, vAssets.borrowID);

    // Check Debt is > zero
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

    flasher.initiateFlashloan(info, _flashnum);
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
  ) external onlyFlash {
    // Create Instance of FujiERC1155
    IFujiERC1155 f1155 = IFujiERC1155(IVault(_vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in f1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(_vault).vAssets();

    // Get user Collateral and Debt Balances
    uint256 userCollateral = f1155.balanceOf(_userAddr, vAssets.collateralID);
    uint256 userDebtBalance = f1155.balanceOf(_userAddr, vAssets.borrowID);

    // Get user Collateral + Flash Close Fee to close posisition, for _amount passed
    uint256 userCollateralInPlay = (IVault(_vault).getNeededCollateralFor(
      _amount + _flashloanFee,
      false
    ) * flashCloseF.a) / flashCloseF.b;

    // TODO: Get => corresponding amount of BaseProtocol Debt and FujiDebt

    // Repay BaseProtocol debt
    IVault(_vault).payback(int256(_amount));

    //TODO: Transfer corresponding Debt Amount to Fuji Treasury

    // Full close
    if (_amount == userDebtBalance) {
      f1155.burn(_userAddr, vAssets.collateralID, userCollateral);

      // Withdraw Full collateral
      IVault(_vault).withdraw(int256(userCollateral));

      // Send unUsed Collateral to User
      IERC20(vAssets.collateralAsset).univTransfer(
        _userAddr,
        userCollateral - userCollateralInPlay
      );
    } else {
      f1155.burn(_userAddr, vAssets.collateralID, userCollateralInPlay);

      // Withdraw Collateral in play Only
      IVault(_vault).withdraw(int256(userCollateralInPlay));
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

    emit FlashClose(_userAddr, vAssets.borrowAsset, userDebtBalance);
  }

  /**
   * @dev Initiates a flashloan to liquidate array of undercollaterized debt positions,
   * gets bonus (bonusFlashL in Vault)
   * @param _userAddrs: Array of Address whose position is liquidatable
   * @param _vault: The vault address where the debt position exist.
   * @param _flashnum: integer identifier of flashloan provider
   */
  function flashBatchLiquidate(
    address[] calldata _userAddrs,
    address _vault,
    uint8 _flashnum
  ) external isValidVault(_vault) nonReentrant {
    // Update Balances at FujiERC1155
    IVault(_vault).updateF1155Balances();

    // Create Instance of FujiERC1155
    IFujiERC1155Ext f1155 = IFujiERC1155Ext(IVault(_vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in f1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(_vault).vAssets();

    address[] memory formattedUserAddrs = new address[](2 * _userAddrs.length);
    uint256[] memory formattedIds = new uint256[](2 * _userAddrs.length);

    // Build the required Arrays to query balanceOfBatch from f1155
    for (uint256 i = 0; i < _userAddrs.length; i++) {
      formattedUserAddrs[2 * i] = _userAddrs[i];
      formattedUserAddrs[2 * i + 1] = _userAddrs[i];
      formattedIds[2 * i] = vAssets.collateralID;
      formattedIds[2 * i + 1] = vAssets.borrowID;
    }

    // Get user Collateral and Debt Balances
    uint256[] memory usrsBals = f1155.balanceOfBatch(formattedUserAddrs, formattedIds);

    uint256 neededCollateral;
    uint256 debtBalanceTotal;

    for (uint256 i = 0; i < formattedUserAddrs.length; i += 2) {
      // Compute Amount of Minimum Collateral Required including factors
      neededCollateral = IVault(_vault).getNeededCollateralFor(usrsBals[i + 1], true);

      // Check if User is liquidatable
      if (usrsBals[i] < neededCollateral) {
        // If true, add User debt balance to the total balance to be liquidated
        debtBalanceTotal = debtBalanceTotal + usrsBals[i + 1];
      } else {
        // Replace User that is not liquidatable by Zero Address
        formattedUserAddrs[i] = address(0);
        formattedUserAddrs[i + 1] = address(0);
      }
    }

    // Check there is at least one user liquidatable
    require(debtBalanceTotal > 0, Errors.VL_USER_NOT_LIQUIDATABLE);

    Flasher flasher = Flasher(payable(_fujiAdmin.getFlasher()));

    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.BatchLiquidate,
      asset: vAssets.borrowAsset,
      amount: debtBalanceTotal,
      vault: _vault,
      newProvider: address(0),
      userAddrs: formattedUserAddrs,
      userBalances: usrsBals,
      userliquidator: msg.sender,
      fliquidator: address(this)
    });

    flasher.initiateFlashloan(info, _flashnum);
  }

  /**
   * @dev Liquidate a debt position by using a flashloan
   * @param _userAddrs: array **See formattedUserAddrs construction in 'function flashBatchLiquidate'
   * @param _usrsBals: array **See construction in 'function flashBatchLiquidate'
   * @param _liquidatorAddr: liquidator address
   * @param _vault: Vault address
   * @param _amount: amount of debt to be repaid
   * @param _flashloanFee: amount extra charged by flashloan provider
   * Emits a {FlashLiquidate} event.
   */
  function executeFlashBatchLiquidation(
    address[] calldata _userAddrs,
    uint256[] calldata _usrsBals,
    address _liquidatorAddr,
    address _vault,
    uint256 _amount,
    uint256 _flashloanFee
  ) external onlyFlash {
    // Create Instance of FujiERC1155
    IFujiERC1155 f1155 = IFujiERC1155(IVault(_vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in f1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(_vault).vAssets();

    // TODO: Get => corresponding amount of BaseProtocol Debt and FujiDebt
    // TODO: Transfer corresponding Debt Amount to Fuji Treasury

    // Repay BaseProtocol debt to release collateral
    IVault(_vault).payback(int256(_amount));

    // Compute the Liquidator Bonus bonusFlashL
    uint256 globalBonus = IVault(_vault).getLiquidationBonusFor(_amount, true);

    // Compute how much collateral needs to be swapt for all liquidated Users
    uint256 globalCollateralInPlay = _getCollateralInPlay(
      vAssets.collateralAsset,
      vAssets.borrowAsset,
      _amount + _flashloanFee + globalBonus
    );

    // Burn Collateral f1155 tokens for each liquidated user
    _burnMultiLoop(_userAddrs, _usrsBals, IVault(_vault), f1155, vAssets);

    // Withdraw collateral
    IVault(_vault).withdraw(int256(globalCollateralInPlay));

    _swap(
      vAssets.collateralAsset,
      vAssets.borrowAsset,
      _amount + _flashloanFee + globalBonus,
      globalCollateralInPlay,
      true
    );

    // Send flasher the underlying to repay Flashloan
    IERC20(vAssets.borrowAsset).univTransfer(
      payable(_fujiAdmin.getFlasher()),
      _amount + _flashloanFee
    );

    // Transfer Bonus bonusFlashL to liquidator, minus FlashloanFee convenience
    IERC20(vAssets.borrowAsset).univTransfer(payable(_liquidatorAddr), globalBonus - _flashloanFee);

    // Burn Debt f1155 tokens and Emit Liquidation Event for Each Liquidated User
    for (uint256 i = 0; i < _userAddrs.length; i += 2) {
      if (_userAddrs[i] != address(0)) {
        f1155.burn(_userAddrs[i], vAssets.borrowID, _usrsBals[i + 1]);
        emit FlashLiquidate(_userAddrs[i], _liquidatorAddr, vAssets.borrowAsset, _usrsBals[i + 1]);
      }
    }
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
      uint256 priceFromOracle = oracle.getPriceOf(
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

  /**
   * @dev Abstracted function to perform MultBatch Burn of Collateral in Batch Liquidation
   * checking bonus paid to liquidator by each
   * See "function executeFlashBatchLiquidation"
   */
  function _burnMultiLoop(
    address[] memory _userAddrs,
    uint256[] memory _usrsBals,
    IVault _vault,
    IFujiERC1155 _f1155,
    IVaultExt.VaultAssets memory _vAssets
  ) internal {
    uint256 bonusPerUser;
    uint256 collateralInPlayPerUser;

    for (uint256 i = 0; i < _userAddrs.length; i += 2) {
      if (_userAddrs[i] != address(0)) {
        bonusPerUser = _vault.getLiquidationBonusFor(_usrsBals[i + 1], true);

        collateralInPlayPerUser = _getCollateralInPlay(
          _vAssets.collateralAsset,
          _vAssets.borrowAsset,
          _usrsBals[i + 1] + bonusPerUser
        );

        _f1155.burn(_userAddrs[i], _vAssets.collateralID, collateralInPlayPerUser);
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
    oracle = IFujiOracle(_newFujiOracle);
  }
}
