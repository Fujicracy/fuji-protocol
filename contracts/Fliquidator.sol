// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { UniERC20 } from "./LibUniERC20.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IVault} from "./IVault.sol";
import {IDebtToken} from "./IDebtToken.sol";
import {Errors} from "./Debt-token/Errors.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { UniERC20 } from "./LibUniERC20.sol";
import { Flasher } from "./flashloans/Flasher.sol";
import { FlashLoan } from "./flashloans/LibFlashLoan.sol";

contract Fliquidator {

  using SafeMath for uint256;
  using UniERC20 for IERC20;

  IUniswapV2Router02 public uniswap;

  // Log Liquidation
  event evLiquidate(address userAddr, address liquidator, uint256 amount);
  // Log FlashClose
  event FlashClose(address userAddr, uint256 amount);
  // Log Liquidation
  event FlashLiquidate(address userAddr, address liquidator, uint256 amount);

  constructor(address _uniswap) public {
    uniswap = IUniswapV2Router02(_uniswap);
  }

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
    IVault(vault).payback(userDebtBalance);

    // withdraw collateral
    IVault(vault).withdraw(userCollateral);

    // get 5% of user debt
    uint256 bonus = IVault(vault).getLiquidationBonusFor(userDebtBalance, false);

    // Reduce collateralBalance
    uint256 newcollateralBalance = (IVault(vault).getcollateralBalance()).sub(userCollateral);
    IVault(vault).setVaultCollateralBalance(newcollateralBalance);
    // update user collateral
    IVault(vault).setUsercollateral(_userAddr, 0);

    // transfer 5% of debt position to liquidator
    IERC20(IVault(vault).getCollateralAsset()).uniTransfer(msg.sender, bonus);
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
  * @dev Initiates a flashloan used to repay partially or fully the debt position of msg.sender
  * @param _amount: Choose zero to fully close debt position, otherwise Amount to be repaid with a flashloan
  *@param vault: The vault address where the debt position exist.
  */
  function flashClose(uint256 _amount, address vault) external {

    IVault(vault).updateDebtTokenBalances();
    address debtToken = IVault(vault).debtToken();

    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(msg.sender);
    require(userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);
    require(_amount <= userDebtBalance, Errors.VL_DEBT_LESS_THAN_AMOUNT);

    Flasher tflasher = Flasher(IVault(vault).getFlasher());

    if(_amount == 0) {

      FlashLoan.Info memory info = FlashLoan.Info({
        callType: FlashLoan.CallType.Close,
        asset: IVault(vault).getBorrowAsset(),
        amount: userDebtBalance,
        vault: vault,
        newProvider: address(0),
        user: msg.sender,
        userliquidator: address(0),
        fliquidator: address(this)
      });

      tflasher.initiateDyDxFlashLoan(info);

    } else {
      FlashLoan.Info memory info = FlashLoan.Info({
        callType: FlashLoan.CallType.Close,
        asset: IVault(vault).getBorrowAsset(),
        amount: _amount,
        vault: vault,
        newProvider: address(0),
        user: msg.sender,
        userliquidator: address(0),
        fliquidator: address(this)
      });

      tflasher.initiateDyDxFlashLoan(info);

    }
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
    uint256 neededCollateral = IVault(vault).getNeededCollateralFor(userDebtBalance);
    require(
      userCollateral >= neededCollateral,
      Errors.VL_USER_NOT_LIQUIDATABLE
    );

    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.Liquidate,
      asset: IVault(vault).getBorrowAsset(),
      amount: userDebtBalance,
      vault: vault,
      newProvider: address(0),
      user: _userAddr,
      userliquidator: msg.sender,
      fliquidator: address(this)
    });

    Flasher tflasher = Flasher(IVault(vault).getFlasher());
    tflasher.initiateDyDxFlashLoan(info);
  }

  /**
  * @dev Close user's debt position by using a flashloan
  * @param _userAddr: user addr to be liquidated
  * @param _debtAmount: amount of debt to be repaid
  * Emits a {FlashClose} event.
  */
  function executeFlashClose(address _userAddr, uint256 _debtAmount, address vault) external {

    address debtToken = IVault(vault).debtToken();

    // TODO make callable only from Flasher
    uint256 userCollateral = IVault(vault).getUsercollateral(_userAddr);
    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(_userAddr);

    // reduce collateralBalance
    uint256 newcollateralBalance = (IVault(vault).getcollateralBalance()).sub(userCollateral);
    IVault(vault).setVaultCollateralBalance(newcollateralBalance);
    // update user collateral
    IVault(vault).setUsercollateral(_userAddr, 0);

    uint leftover = _repayAndSwap(userDebtBalance, userCollateral, _debtAmount, vault);

    // cast user addr to payable
    address payable user = address(uint160(_userAddr));
    // transfer left ETH amount to user
    IERC20(IVault(vault).getCollateralAsset()).uniTransfer(user, userCollateral.sub(leftover));

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
  function executeFlashLiquidation(address _userAddr,address _liquidatorAddr,uint256 _debtAmount, address vault) external {

    address debtToken = IVault(vault).debtToken();

    // TODO make callable only from Flasher
    uint256 userCollateral = IVault(vault).getUsercollateral(_userAddr);
    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(_userAddr);

    // reduce collateralBalance
    uint256 newcollateralBalance = (IVault(vault).getcollateralBalance()).sub(userCollateral);
    IVault(vault).setVaultCollateralBalance(newcollateralBalance);
    // update user collateral
    IVault(vault).setUsercollateral(_userAddr, 0);

    uint256 leftover = _repayAndSwap(userDebtBalance, userCollateral, _debtAmount, vault);

    // get 4% of user debt
    uint256 bonus = IVault(vault).getLiquidationBonusFor(_debtAmount, true);
    // cast user addr to payable
    address payable liquidator = address(uint160(_liquidatorAddr));
    // transfer 4% of debt position to liquidator
    IERC20(IVault(vault).getCollateralAsset()).uniTransfer(liquidator, bonus);
    // cast user addr to payable
    address payable user = address(uint160(_userAddr));
    // transfer left collateral to user deducted by bonus
    IERC20(IVault(vault).getCollateralAsset()).uniTransfer(user, leftover.sub(bonus));

    // burn debt
    IDebtToken(debtToken).burn(_userAddr,userDebtBalance);

    emit FlashLiquidate(_userAddr, _liquidatorAddr, userDebtBalance);
  }

  /**
  * @dev Gets borrowAsset from flasher, repays a debt position,
  * withdraws collateral, swaps it on Uniswap and repays flashloan
  * @param _borrowAmount: Borrow amount of the position
  * @param _collateralAmount: Collateral amount of the position
  * @param _debtAmount: Amount of borrowAsset to be repaid to flasher
  * @return leftover amount of collateral after swap
  */
  function _repayAndSwap(
    uint256 _borrowAmount,
    uint256 _collateralAmount,
    uint256 _debtAmount,
    address vault
  ) internal returns(uint) {

    require(
      IERC20(IVault(vault).getBorrowAsset()).allowance(IVault(vault).getFlasher(), address(this)) >= _borrowAmount,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );
    IERC20(IVault(vault).getBorrowAsset()).transferFrom(IVault(vault).getFlasher(), address(this), _borrowAmount);

    // 1. payback current provider
    IVault(vault).payback(_borrowAmount);

    // 2. withdraw collateral from current provider
    IVault(vault).withdraw(_collateralAmount);

    // swap withdrawn ETH for DAI on uniswap
    address[] memory path = new address[](2);
    path[0] = uniswap.WETH();
    path[1] = IVault(vault).getBorrowAsset();
    uint[] memory uniswapAmounts = uniswap.swapETHForExactTokens{ value: _collateralAmount }(
      _debtAmount,
      path,
      address(this),
      block.timestamp
    );

    // return borrowed amount to Flasher
    IERC20(IVault(vault).getBorrowAsset()).uniTransfer(payable(IVault(vault).getFlasher()), _debtAmount);

    return uniswapAmounts[0];
  }

}
