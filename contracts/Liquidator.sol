// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

import {IVault} from "./IVault.sol";
import {IDebtToken} from "./IDebtToken.sol";
import {Errors} from "./Debt-token/Errors.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { UniERC20 } from "./LibUniERC20.sol";
import { Flasher } from "./flashloans/Flasher.sol";
import { FlashLoan } from "./flashloans/LibFlashLoan.sol";

contract Liquidator {

  // Log Liquidation
  event evLiquidate(address userAddr, address liquidator, uint256 amount);
  // Log FlashClose
  event FlashClose(address userAddr, uint256 amount);
  // Log Liquidation
  event FlashLiquidate(address userAddr, address liquidator, uint256 amount);

  /**
  * @dev Liquidate an undercollaterized debt and get 5% bonus
  * @param _userAddr: Address of user whose position is liquidatable
  */
  function liquidate(address _userAddr, address vault) external {

    IVault(vault).updateDebtTokenBalances();
    address debtToken = IVault(vault).debtToken();

    uint256 userCollateral = IVault(vault).getUsercollateral(_userAddr);
    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(_userAddr);

    // do checks user is liquidatable
    uint256 neededCollateral = IVault(vault).getNeededCollateralFor(userDebtBalance);
    require(
      userCollateral >= neededCollateral,
      Errors.VL_USER_NOT_LIQUIDATABLE
    );

    // transfer borrowAsset from liquidator to vault
    require(
      IERC20(IVault(vault).getBorrowAsset()).allowance(msg.sender, address(this)) >= userDebtBalance,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );
    IERC20(IVault(vault).getBorrowAsset()).transferFrom(msg.sender, address(this), userDebtBalance);

    // repay debt
    IVault(vault)._payback(userDebtBalance, IVault(vault).activeProvider());

    // withdraw collateral
    IVault(vault)._withdraw(userCollateral, IVault(vault).activeProvider());

    // get 5% of user debt
    uint256 bonus = IVault(vault).getLiquidationBonusFor(userDebtBalance, false);

    // Reduce collateralBalance
    uint256 newcollateralBalance = (IVault(vault).collateralBalance()).sub(userCollateral);
    IVault(vault).setCollateralBalance(newcollateralBalance);
    // update user collateral
    IVault(vault).setUsercollateral(_userAddr, 0);

    // transfer 5% of debt position to liquidator
    IERC20(IVault(vault).collateralAsset()).uniTransfer(msg.sender, bonus);
    // cast user addr to payable
    address payable user = address(uint160(_userAddr));
    // transfer left collateral to user
    uint256 leftover = userCollateral.sub(bonus);
    IERC20(IVault(vault).getCollateralAsset()).uniTransfer(user, leftover);

    // burn debt
    IDebtToken(debtToken).burn(_userAddr,userDebtBalance);

    emit evLiquidate(_userAddr, msg.sender, userDebtBalance);
  }

  /**
  * @dev Initiates a flashloan used to repay partially a debt position of msg.sender
  * @param _amount: Amount to be repaid with a flashloan
  */
  function flashClosePartial(uint256 _amount, address vault) external {

    IVault(vault).updateDebtTokenBalances();
    address debtToken = IVault(vault).debtToken();

    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(msg.sender);
    require(userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);
    require(_amount <= userDebtBalance, Errors.VL_DEBT_LESS_THAN_AMOUNT);

    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.Close,
      asset: IVault(vault).getBorrowAsset(),
      amount: _amount,
      vault: address(this),
      newProvider: address(0),
      user: msg.sender,
      liquidator: address(0)
    });

    flasher.initiateDyDxFlashLoan(info);
  }

  /**
  * @dev Initiates a flashloan used to repay the total of msg.sender's debt position
  */
  function flashCloseTotal(address vault) external {

    IVault(vault).updateDebtTokenBalances();
    address debtToken = IVault(vault).debtToken();

    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(msg.sender);
    require(userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);

    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.Close,
      asset: borrowAsset,
      amount: userDebtBalance,
      vault: address(this),
      newProvider: address(0),
      user: msg.sender,
      liquidator: address(0)
    });

    flasher.initiateDyDxFlashLoan(info);
  }

  /**
  * @dev Initiates a flashloan to liquidate an undercollaterized debt position,
  * gets 4% bonus
  * @param _userAddr: Address of user whose position is liquidatable
  */
  function flashLiquidate(address _userAddr, address vault) external {

    IVault(vault).updateDebtTokenBalances();
    address debtToken = IVault(vault).debtToken();

    uint256 userCollateral = IVault(vault).getUsercollateral(_userAddr);
    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(_userAddr);

    // do checks user is liquidatable
    uint256 neededCollateral = getNeededCollateralFor(userDebtBalance);
    require(
      userCollateral >= neededCollateral,
      Errors.VL_USER_NOT_LIQUIDATABLE
    );

    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.Liquidate,
      asset: borrowAsset,
      amount: userDebtBalance,
      vault: address(this),
      newProvider: address(0),
      user: _userAddr,
      liquidator: msg.sender
    });

    flasher.initiateDyDxFlashLoan(info);
  }

  /**
  * @dev Close user's debt position by using a flashloan
  * @param _userAddr: user addr to be liquidated
  * @param _debtAmount: amount of debt to be repaid
  * Emits a {FlashClose} event.
  */
  function executeFlashClose(address _userAddr, uint256 _debtAmount) external override {
    // TODO make callable only from Flasher
    uint256 userCollateral = collaterals[_userAddr];
    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(_userAddr);

    // reduce collateralBalance
    collateralBalance = collateralBalance.sub(userCollateral);
    // update user collateral
    collaterals[_userAddr] = 0;

    uint leftover = _repayAndSwap(userDebtBalance, userCollateral, _debtAmount);

    // cast user addr to payable
    address payable user = address(uint160(_userAddr));
    // transfer left ETH amount to user
    IERC20(collateralAsset).uniTransfer(user, userCollateral.sub(leftover));

    // burn debt
    IDebtToken(debtToken).burn(_userAddr,userDebtBalance);

    emit FlashClose(_userAddr, userDebtBalance);
  }

  /**
  * @dev Liquidate a debt position by using a flashloan
  * @param _userAddr: user addr to be liquidated
  * @param _liquidatorAddr: liquidator address
  * @param _debtAmount: amount of debt to be repaid
  * Emits a {FlashLiquidate} event.
  */
  function executeFlashLiquidation(address _userAddr,address _liquidatorAddr,uint256 _debtAmount) external override {
    // TODO make callable only from Flasher
    uint256 userCollateral = collaterals[_userAddr];
    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(_userAddr);

    // reduce collateralBalance
    collateralBalance = collateralBalance.sub(userCollateral);
    // update user collateral
    collaterals[_userAddr] = 0;

    uint256 leftover = _repayAndSwap(userDebtBalance, userCollateral, _debtAmount);

    // get 4% of user debt
    uint256 bonus = getLiquidationBonusFor(_debtAmount, true);
    // cast user addr to payable
    address payable liquidator = address(uint160(_liquidatorAddr));
    // transfer 4% of debt position to liquidator
    IERC20(collateralAsset).uniTransfer(liquidator, bonus);
    // cast user addr to payable
    address payable user = address(uint160(_userAddr));
    // transfer left collateral to user deducted by bonus
    IERC20(collateralAsset).uniTransfer(user, leftover.sub(bonus));

    // burn debt
    IDebtToken(debtToken).burn(_userAddr,userDebtBalance);

    emit FlashLiquidate(_userAddr, _liquidatorAddr, userDebtBalance);
  }

}
