// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12 <0.8.0;
pragma experimental ABIEncoderV2;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Errors} from '../Libraries/Errors.sol';

import { ILendingPool, IFlashLoanReceiver } from "./AaveFlashLoans.sol";
import {
  Actions,
  Account,
  DyDxFlashloanBase,
  ICallee,
  ISoloMargin
} from "./DyDxFlashLoans.sol";
import { FlashLoan } from "./LibFlashLoan.sol";
import { IVault } from "../Vaults/IVault.sol";

interface IFliquidator {

  function executeFlashClose(address _userAddr, uint256 _debtAmount, address vault) external;

  function executeFlashLiquidation(address _userAddr,address _liquidatorAddr,uint256 _debtAmount, address vault) external;
}

contract Flasher is
  DyDxFlashloanBase,
  IFlashLoanReceiver,
  ICallee,
  Ownable
{

  using SafeMath for uint256;

  address public controller;
  address public fliquidator;

  address public aave_lending_pool;
  address public dydx_solo_margin;
  address public flashloanProvider3;
  address public flashloanProvider4;

  constructor() public {

    aave_lending_pool = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
    dydx_solo_margin = 0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e;

  }

  modifier isAuthorized() {
    require(
      msg.sender == controller ||
      msg.sender == fliquidator ||
      msg.sender == owner(),
      Errors.VL_NOT_AUTHORIZED
    );
    _;
  }

  modifier isAuthorizedExternal() {
    require(
      msg.sender == dydx_solo_margin ||
      msg.sender == aave_lending_pool,
      Errors.VL_NOT_AUTHORIZED
    );
    _;
  }

  /**
  * @dev Sets new controller.
  * @param _controller: Address of controller
  */
  function setController(address _controller) external isAuthorized {
    controller = _controller;
  }

  /**
  * @dev Sets the fliquidator address
  * @param _newfliquidator: new fliquidator address
  */
  function setfliquidator(address _newfliquidator) external isAuthorized {
    fliquidator = _newfliquidator;
  }


  // ===================== DyDx FlashLoan ===================================

  /**
  * @dev Initiates a DyDx flashloan.
  * @param info: data to be passed between functions executing flashloan logic
  */
  function initiateDyDxFlashLoan(
    FlashLoan.Info memory info
  ) public isAuthorized {

    ISoloMargin solo = ISoloMargin(dydx_solo_margin);

    // Get marketId from token address
    uint256 marketId = _getMarketIdFromTokenAddress(solo, info.asset);

    // 1. Withdraw $
    // 2. Call callFunction(...)
    // 3. Deposit back $
    Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](3);

    operations[0] = _getWithdrawAction(marketId, info.amount);
    // Encode FlashLoan.Info for callFunction
    operations[1] = _getCallAction(abi.encode(info));
    // add fee of 2 wei
    operations[2] = _getDepositAction(marketId, info.amount.add(2));

    Account.Info[] memory accountInfos = new Account.Info[](1);
    accountInfos[0] = _getAccountInfo(address(this));

    solo.operate(accountInfos, operations);
  }

  /**
  * @dev Executes DyDx Flashloan, this operation is required
  * and called by Solo when sending loaned amount
  * @param sender: Not used
  * @param account: Not used
  */
  function callFunction(
    address sender,
    Account.Info memory account,
    bytes memory data
  ) external override isAuthorizedExternal {
    sender;
    account;

    FlashLoan.Info memory info = abi.decode(data, (FlashLoan.Info));

    //Estimate flashloan payback + premium fee of 2 wei,
    uint amountOwing = info.amount.add(2);

    if (info.callType == FlashLoan.CallType.Switch) {

      // Approve vault to spend ERC20
      IERC20(info.asset).approve(info.vault, info.amount);
      IVault(info.vault).executeSwitch(info.newProvider, amountOwing);
    }
    else if (info.callType == FlashLoan.CallType.Close) {

      // Approve Fliquidator to spend ERC20
      IERC20(info.asset).approve(info.fliquidator, info.amount);
      IFliquidator(info.fliquidator).executeFlashClose(info.user, info.asset, info.amount, info.vault);
    }
    else {

      // Approve Fliquidator to spend ERC20
      IERC20(info.asset).approve(info.fliquidator, info.amount);
      IFliquidator(info.fliquidator).executeFlashLiquidation(info.user, info.userliquidator, info.amount, info.vault);
    }

    //Approve DYDXSolo to spend to repay flashloan
    IERC20(info.asset).approve(dydx_solo_margin, amountOwing);
  }


  // ===================== Aave FlashLoan ===================================

  /**
  * @dev Initiates an Aave flashloan.
  * @param info: data to be passed between functions executing flashloan logic
  */
  function initiateAaveFlashLoan(
    FlashLoan.Info memory info
  ) external isAuthorized {

    //Initialize Instance of Aave Lending Pool
    ILendingPool aaveLp = ILendingPool(aave_lending_pool);

    //Passing arguments to construct Aave flashloan -limited to 1 asset type for now.
    address receiverAddress = address(this);
    address[] memory assets = new address[](1);
    assets[0] = address(info.asset);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = info.amount;

    // 0 = no debt, 1 = stable, 2 = variable
    uint256[] memory modes = new uint256[](1);
    modes[0] = 0;

    address onBehalfOf = address(this);
    bytes memory params = abi.encode(info);
    uint16 referralCode = 0;

    //Aave Flashloan initiated.
    aaveLp.flashLoan(
      receiverAddress,
      assets,
      amounts,
      modes,
      onBehalfOf,
      params,
      referralCode
    );
  }

  /**
  * @dev Executes Aave Flashloan, this operation is required
  * and called by Aaveflashloan when sending loaned amount
  */
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external override isAuthorizedExternal returns (bool) {
    initiator;

    FlashLoan.Info memory info = abi.decode(params, (FlashLoan.Info));

    //Estimate flashloan payback + premium fee,
    uint amountOwing = amounts[0].add(premiums[0]);

    //approve vault to spend ERC20
    IERC20(assets[0]).approve(info.vault, amountOwing);

    if (info.callType == FlashLoan.CallType.Switch) {
      IVault(info.vault).executeSwitch(info.newProvider, amountOwing);
    }
    else if (info.callType == FlashLoan.CallType.Close) {
      IFliquidator(info.fliquidator).executeFlashClose(info.user, amountOwing, info.vault);
    }
    else {
      IFliquidator(info.fliquidator).executeFlashLiquidation(info.user, info.userliquidator, amountOwing,info.vault);
    }

    //Approve aaveLP to spend to repay flashloan
    IERC20(assets[0]).approve(address(aave_lending_pool), amountOwing);

    return true;
  }

  //receive() external payable {}
}
