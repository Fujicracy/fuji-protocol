// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import { IVault } from "./Vaults/IVault.sol";
import { IFujiAdmin } from "./IFujiAdmin.sol";
import { IFujiERC1155 } from "./FujiERC1155/IFujiERC1155.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Flasher } from "./Flashloans/Flasher.sol";
import { FlashLoan } from "./Flashloans/LibFlashLoan.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Errors } from "./Libraries/Errors.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { UniERC20 } from "./Libraries/LibUniERC20.sol";
import {
  IUniswapV2Router02
} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
  using SafeMath for uint256;
  using UniERC20 for IERC20;

  struct Factor {
    uint64 a;
    uint64 b;
  }

  // Flash Close Fee Factor
  Factor public flashCloseF;

  IFujiAdmin private _fujiAdmin;
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

  constructor() public {
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
  function batchLiquidate(address[] calldata _userAddrs, address _vault) external {
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
      require(usrsBals[i] < neededCollateral, Errors.VL_USER_NOT_LIQUIDATABLE);

      // Add total debt balance to be liquidated
      debtBalanceTotal = debtBalanceTotal.add(usrsBals[i + 1]);
    }

    // Check Liquidator Allowance
    require(
      IERC20(vAssets.borrowAsset).allowance(msg.sender, address(this)) >= debtBalanceTotal,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );

    // Transfer borrowAsset funds from the Liquidator to Here
    IERC20(vAssets.borrowAsset).transferFrom(msg.sender, address(this), debtBalanceTotal);

    // Transfer Amount to Vault
    IERC20(vAssets.borrowAsset).transfer(_vault, debtBalanceTotal);

    // TODO: Get => corresponding amount of BaseProtocol Debt and FujiDebt

    // Repay BaseProtocol debt
    IVault(_vault).payback(int256(debtBalanceTotal));

    //TODO: Transfer corresponding Debt Amount to Fuji Treasury

    // Compute the Liquidator Bonus bonusL
    uint256 globalBonus = IVault(_vault).getLiquidationBonusFor(debtBalanceTotal, false);
    // Compute how much collateral needs to be swapt
    uint256 globalCollateralInPlay =
      _getCollateralInPlay(vAssets.borrowAsset, debtBalanceTotal.add(globalBonus));

    // Burn Collateral f1155 tokens for each liquidated user
    _burnMultiLoop(formattedUserAddrs, usrsBals, IVault(_vault), f1155, vAssets);

    // Withdraw collateral
    IVault(_vault).withdraw(int256(globalCollateralInPlay));

    // Swap Collateral
    _swap(vAssets.borrowAsset, debtBalanceTotal.add(globalBonus), globalCollateralInPlay);

    // Transfer to Liquidator the debtBalance + bonus
    IERC20(vAssets.borrowAsset).uniTransfer(msg.sender, debtBalanceTotal.add(globalBonus));

    // Burn Debt f1155 tokens and Emit Liquidation Event for Each Liquidated User
    for (uint256 i = 0; i < formattedUserAddrs.length; i += 2) {
      f1155.burn(formattedUserAddrs[i], vAssets.borrowID, usrsBals[i + 1]);
      emit Liquidate(formattedUserAddrs[i], msg.sender, vAssets.borrowAsset, usrsBals[i + 1]);
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
  ) external nonReentrant {
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

    FlashLoan.Info memory info =
      FlashLoan.Info({
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
    uint256 userCollateralInPlay =
      IVault(_vault)
        .getNeededCollateralFor(_amount.add(_flashloanFee), false)
        .mul(flashCloseF.a)
        .div(flashCloseF.b);

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
      _userAddr.transfer(userCollateral.sub(userCollateralInPlay));
    } else {
      f1155.burn(_userAddr, vAssets.collateralID, userCollateralInPlay);

      // Withdraw Collateral in play Only
      IVault(_vault).withdraw(int256(userCollateralInPlay));
    }

    // Swap Collateral for underlying to repay Flashloan
    uint256 remaining =
      _swap(vAssets.borrowAsset, _amount.add(_flashloanFee), userCollateralInPlay);

    // Send FlashClose Fee to FujiTreasury
    IERC20(vAssets.collateralAsset).uniTransfer(_fujiAdmin.getTreasury(), remaining);

    // Send flasher the underlying to repay Flashloan
    IERC20(vAssets.borrowAsset).uniTransfer(
      payable(_fujiAdmin.getFlasher()),
      _amount.add(_flashloanFee)
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
  ) external nonReentrant {
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
      require(usrsBals[i] < neededCollateral, Errors.VL_USER_NOT_LIQUIDATABLE);

      // Add total debt balance to be liquidated
      debtBalanceTotal = debtBalanceTotal.add(usrsBals[i + 1]);
    }

    Flasher flasher = Flasher(payable(_fujiAdmin.getFlasher()));

    FlashLoan.Info memory info =
      FlashLoan.Info({
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
    uint256 globalCollateralInPlay =
      _getCollateralInPlay(vAssets.borrowAsset, _amount.add(_flashloanFee).add(globalBonus));

    // Burn Collateral f1155 tokens for each liquidated user
    _burnMultiLoop(_userAddrs, _usrsBals, IVault(_vault), f1155, vAssets);

    // Withdraw collateral
    IVault(_vault).withdraw(int256(globalCollateralInPlay));

    _swap(vAssets.borrowAsset, _amount.add(_flashloanFee).add(globalBonus), globalCollateralInPlay);

    // Send flasher the underlying to repay Flashloan
    IERC20(vAssets.borrowAsset).uniTransfer(
      payable(_fujiAdmin.getFlasher()),
      _amount.add(_flashloanFee)
    );

    // Transfer Bonus bonusFlashL to liquidator, minus FlashloanFee convenience
    IERC20(vAssets.borrowAsset).uniTransfer(
      payable(_liquidatorAddr),
      globalBonus.sub(_flashloanFee)
    );

    // Burn Debt f1155 tokens and Emit Liquidation Event for Each Liquidated User
    for (uint256 i = 0; i < _userAddrs.length; i += 2) {
      f1155.burn(_userAddrs[i], vAssets.borrowID, _usrsBals[i + 1]);
      emit FlashLiquidate(_userAddrs[i], _liquidatorAddr, vAssets.borrowAsset, _usrsBals[i + 1]);
    }
  }

  /**
   * @dev Swap an amount of underlying
   * @param _borrowAsset: Address of vault borrowAsset
   * @param _amountToReceive: amount of underlying to receive
   * @param _collateralAmount: collateral Amount sent for swap
   */
  function _swap(
    address _borrowAsset,
    uint256 _amountToReceive,
    uint256 _collateralAmount
  ) internal returns (uint256) {
    // Swap Collateral Asset to Borrow Asset
    address[] memory path = new address[](2);
    path[0] = swapper.WETH();
    path[1] = _borrowAsset;
    uint256[] memory swapperAmounts =
      swapper.swapETHForExactTokens{ value: _collateralAmount }(
        _amountToReceive,
        path,
        address(this),
        // solhint-disable-next-line
        block.timestamp
      );

    return _collateralAmount.sub(swapperAmounts[0]);
  }

  /**
   * @dev Get exact amount of collateral to be swapt
   * @param _borrowAsset: Address of vault borrowAsset
   * @param _amountToReceive: amount of underlying to receive
   */
  function _getCollateralInPlay(address _borrowAsset, uint256 _amountToReceive)
    internal
    view
    returns (uint256)
  {
    address[] memory path = new address[](2);
    path[0] = swapper.WETH();
    path[1] = _borrowAsset;
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
      bonusPerUser = _vault.getLiquidationBonusFor(_usrsBals[i + 1], true);

      collateralInPlayPerUser = _getCollateralInPlay(
        _vAssets.borrowAsset,
        _usrsBals[i + 1].add(bonusPerUser)
      );

      _f1155.burn(_userAddrs[i], _vAssets.collateralID, collateralInPlayPerUser);
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
}
