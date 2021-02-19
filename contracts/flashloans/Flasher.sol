// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.5;
pragma experimental ABIEncoderV2;

import "./AaveFlashLoans.sol";
import "./DyDxFlashLoans.sol";
import "./LibFlashLoan.sol";
import "../LibUniERC20.sol";
import "../VaultETHDAI.sol";
import { DebtToken } from "../DebtToken.sol";

contract Flasher is DyDxFlashloanBase, IFlashLoanReceiver, ICallee {

  using SafeMath for uint256;

  address controller;
  address owner;

  address constant AAVE_LENDING_POOL = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
  address constant DYDX_SOLO_MARGIN = 0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e;

  modifier isAuthorized() {
    require(
      msg.sender == controller || msg.sender == owner || msg.sender == DYDX_SOLO_MARGIN || msg.sender == AAVE_LENDING_POOL,
      "!authorized"
    );
    _;
  }

  constructor(
    address _owner
  ) public {
    owner = _owner;
  }

  /**
  * @dev Sets new controller.
  * @param _controller: Address of controller
  */
  function setController(
    address _controller
  ) external isAuthorized {
    controller = _controller;
  }

  /**
  * @dev Initiates a flashloan used to repay a debt position of msg.sender
  * @param _vaultAddr: Vault address where msg.sender has a debt position
  */
  function initiateSelfLiquidation(
    address _vaultAddr
  ) external {
    IVault vault = IVault(_vaultAddr);
    DebtToken debtToken = vault.debtToken();
    vault.updateDebtTokenBalances();
    uint256 debtPosition = debtToken.balanceOf(msg.sender);

    require(debtPosition > 0, "No debt to liquidate");

    initiateDyDxFlashLoan(
      FlashLoan.CallType.SelfLiquidate,
      _vaultAddr,
      msg.sender,
      vault.borrowAsset(),
      debtPosition
    );
  }

  // ===================== DyDx FlashLoan ===================================

  /**
  * @dev Initiates a DyDx flashloan.
  * @param _callType: Used to determine which vault's function to call post-flashloan:
  * - Switch for fujiSwitch(...)
  * - SelfLiquidate for selfLiquidate(...)
  * - Liquidate for liquidate(...)
  * @param _vaultAddr: Vault's address on which the flashloan logic to be executed
  * @param _otherAddr: An address to be passed on vault's function post-flashloan.
  * - Switch - address of new provider 
  * - SelfLiquidate - user's address
  * - Liquidate - user's address
  * @param _borrowAsset: Address of asset to be borrowed with flashloan
  * @param _amount: Amount of asset to be borrowed with flashloan
  */
  function initiateDyDxFlashLoan(
    FlashLoan.CallType _callType,
    address _vaultAddr,
    address _otherAddr,
    address _borrowAsset,
    uint256 _amount
  ) public {
    _checkAuth(_callType, _otherAddr, msg.sender);

    ISoloMargin solo = ISoloMargin(DYDX_SOLO_MARGIN);

    // Get marketId from token address
    uint256 marketId = _getMarketIdFromTokenAddress(solo, _borrowAsset);

    // 1. Withdraw $
    // 2. Call callFunction(...)
    // 3. Deposit back $
    Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](3);

    operations[0] = _getWithdrawAction(marketId, _amount);
    FlashLoan.Info memory info = FlashLoan.Info({
      callType: _callType,
      vault: _vaultAddr,
      other: _otherAddr,
      asset: _borrowAsset,
      amount: _amount,
      premium: 2 // 2 wei
    });
    // Encode FlashLoan.Info for callFunction
    operations[1] = _getCallAction(abi.encode(info));
    operations[2] = _getDepositAction(marketId, _amount.add(2));

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
  ) external override isAuthorized {
    sender;
    account;

    FlashLoan.Info memory info = abi.decode(data, (FlashLoan.Info));

    //approve vault to spend ERC20
    IERC20(info.asset).approve(info.vault, info.amount);

    //Estimate flashloan payback + premium fee,
    uint amountOwing = info.amount.add(info.premium);

    if (info.callType == FlashLoan.CallType.Switch) {
      //call fujiSwitch
      IVault(info.vault).fujiSwitch(info.other, amountOwing);
    }
    else if (info.callType == FlashLoan.CallType.SelfLiquidate) {
      //call selfLiquidate
      IVault(info.vault).selfLiquidate(info.other, amountOwing);
    }
    else {
      revert("Not implemented callType!");
    }

    //Approve solo to spend to repay flashloan
    IERC20(info.asset).approve(DYDX_SOLO_MARGIN, amountOwing);
  }


  // ===================== Aave FlashLoan ===================================

  /**
  * @dev Initiates a Aave flashloan.
  * @param _callType: Used to determine which vault's function to call post-flashloan:
  * - Switch for fujiSwitch(...)
  * - SelfLiquidate for selfLiquidate(...)
  * - Liquidate for liquidate(...)
  * @param _vaultAddr: Vault's address on which the flashloan logic to be executed
  * @param _otherAddr: An address to be passed on vault's function post-flashloan.
  * - Switch - address of new provider 
  * - SelfLiquidate - user's address
  * - Liquidate - user's address
  * @param _borrowAsset: Address of asset to be borrowed with flashloan
  * @param _amount: Amount of asset to be borrowed with flashloan
  */
  function initiateAaveFlashLoan(
    FlashLoan.CallType _callType,
    address _vaultAddr,
    address _otherAddr,
    address _borrowAsset,
    uint256 _amount
  ) external {
    _checkAuth(_callType, _otherAddr, msg.sender);

    //Initialize Instance of Aave Lending Pool
    ILendingPool aaveLp = ILendingPool(AAVE_LENDING_POOL);

    //Passing arguments to construct Aave flashloan -limited to 1 asset type for now.
    address receiverAddress = address(this);
    address[] memory assets = new address[](1);
    assets[0] = address(_borrowAsset);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = _amount;

    // 0 = no debt, 1 = stable, 2 = variable
    uint256[] memory modes = new uint256[](1);
    modes[0] = 0;

    address onBehalfOf = address(this);
    bytes memory params = abi.encode(_callType, _vaultAddr, _otherAddr);
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
  ) external override isAuthorized returns (bool) {
    initiator;

    // 1. callType: Used to determine which vault's function to call post-flashloan:
    // - Switch for fujiSwitch(...)
    // - SelfLiquidate for selfLiquidate(...)
    // - Liquidate for liquidate(...)
    // 2. vault: Vault's address on which the flashloan logic to be executed
    // 3. otherAddr: An address to be passed on vault's function post-flashloan.
    // - Switch - address of new provider 
    // - SelfLiquidate - user's address
    // - Liquidate - user's address
    (
      FlashLoan.CallType callType,
      address vault,
      address otherAddr
    ) = abi.decode(params, (FlashLoan.CallType,address,address));

    //approve vault to spend ERC20
    IERC20(assets[0]).approve(address(vault), amounts[0]);

    //Estimate flashloan payback + premium fee,
    uint amountOwing = amounts[0].add(premiums[0]);

    if (callType == FlashLoan.CallType.Switch) {
      //call fujiSwitch
      IVault(vault).fujiSwitch(otherAddr, amountOwing);
    }
    else if (callType == FlashLoan.CallType.SelfLiquidate) {
      //call selfLiquidate
      IVault(vault).selfLiquidate(otherAddr, amountOwing);
    }
    else {
      revert("Not implemented callType!");
    }

    //Approve aaveLP to spend to repay flashloan
    IERC20(assets[0]).approve(address(AAVE_LENDING_POOL), amountOwing);

    return true;
  }

  // ========================= Helper Functions ====================

  function _checkAuth(
    FlashLoan.CallType _callType,
    address _other,
    address _sender
  ) internal {
    if (_callType == FlashLoan.CallType.Switch) {
      require(_sender == controller, "Only Controller is authorized to switch");
    }
    else if (_callType == FlashLoan.CallType.SelfLiquidate) {
      require(_sender == _other, "Only msg.sender is authorized to self-liquidate");
    }
    else {
      require(_sender != _other, "Msg.sender cannot liquidate self. Call self-liquidate instead");
    }
  }

  //receive() external payable {}
}
