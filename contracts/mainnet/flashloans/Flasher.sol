// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./DyDxFlashLoans.sol";
import "../../abstracts/claimable/Claimable.sol";
import "../../interfaces/IFujiAdmin.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IFlasher.sol";
import "../../interfaces/IFliquidator.sol";
import "../../interfaces/IFujiMappings.sol";
import "../../interfaces/IWETH.sol";
import "../../interfaces/aave/IFlashLoanReceiver.sol";
import "../../interfaces/aave/IAaveLendingPool.sol";
import "../../interfaces/cream/IERC3156FlashLender.sol";
import "../../interfaces/cream/ICFlashloanReceiver.sol";
import "../../interfaces/cream/ICrComptroller.sol";
import "../../interfaces/balancer/IBalancerVault.sol";
import "../../interfaces/balancer/IFlashLoanRecipient.sol";
import "../libraries/LibUniversalERC20.sol";
import "../../libraries/FlashLoans.sol";
import "../../libraries/Errors.sol";

/**
 * @dev Contract that handles Fuji protocol flash loan logic and
 * the specific logic of all active flash loan providers used by Fuji protocol.
 */

contract Flasher is
  IFlasher,
  DyDxFlashloanBase,
  IFlashLoanReceiver,
  ICFlashloanReceiver,
  IFlashLoanRecipient,
  ICallee,
  Claimable
{
  using LibUniversalERC20 for IERC20;

  IFujiAdmin private _fujiAdmin;

  address private constant _ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
  address private constant _WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  address private immutable _aaveLendingPool = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
  address private immutable _dydxSoloMargin = 0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e;

  // IronBank
  address private immutable _cyFlashloanLender = 0x1a21Ab52d1Ca1312232a72f4cf4389361A479829;
  address private immutable _cyComptroller = 0xAB1c342C7bf5Ec5F02ADEA1c2270670bCa144CbB;

  // Balancer
  address private immutable _balancerVault = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;

  bytes32 private _paramsHash;

  // need to be payable because of the conversion ETH <> WETH
  receive() external payable {}

  /**
   * @dev Throws if caller is not 'owner'.
   */
  modifier isAuthorized() {
    require(
      msg.sender == _fujiAdmin.getController() ||
        msg.sender == _fujiAdmin.getFliquidator() ||
        msg.sender == owner(),
      Errors.VL_NOT_AUTHORIZED
    );
    _;
  }

  /**
   * @dev Sets the fujiAdmin Address
   * @param _newFujiAdmin: FujiAdmin Contract Address
   * Emits a {FujiAdminChanged} event.
   */
  function setFujiAdmin(address _newFujiAdmin) public onlyOwner {
    _fujiAdmin = IFujiAdmin(_newFujiAdmin);
    emit FujiAdminChanged(_newFujiAdmin);
  }

  /**
   * @dev Routing Function for Flashloan Provider
   * @param info: struct information for flashLoan
   * @param _flashnum: integer identifier of flashloan provider
   */
  function initiateFlashloan(FlashLoan.Info calldata info, uint8 _flashnum)
    external
    override
    isAuthorized
  {
    require(_paramsHash == "", "_paramsHash should be empty!");
    _paramsHash = keccak256(abi.encode(info));
    if (_flashnum == 0) {
      _initiateAaveFlashLoan(info);
    } else if (_flashnum == 1) {
      _initiateDyDxFlashLoan(info);
    } else if (_flashnum == 2) {
      _initiateCreamFlashLoan(info);
    } else if (_flashnum == 3) {
      _initiateBalancerFlashLoan(info);
    } else {
      revert(Errors.VL_INVALID_FLASH_NUMBER);
    }
  }

  // ===================== DyDx FlashLoan ===================================

  /**
   * @dev Initiates a DyDx flashloan.
   * @param info: data to be passed between functions executing flashloan logic
   */
  function _initiateDyDxFlashLoan(FlashLoan.Info calldata info) internal {
    ISoloMargin solo = ISoloMargin(_dydxSoloMargin);

    // Get marketId from token address
    uint256 marketId = _getMarketIdFromTokenAddress(solo, info.asset == _ETH ? _WETH : info.asset);

    // 1. Withdraw $
    // 2. Call callFunction(...)
    // 3. Deposit back $
    Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](3);

    operations[0] = _getWithdrawAction(marketId, info.amount);
    // Encode FlashLoan.Info for callFunction
    operations[1] = _getCallAction(abi.encode(info));
    // add fee of 2 wei
    operations[2] = _getDepositAction(marketId, info.amount + 2);

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
    Account.Info calldata account,
    bytes calldata data
  ) external override {
    require(msg.sender == _dydxSoloMargin && sender == address(this), Errors.VL_NOT_AUTHORIZED);
    account;

    FlashLoan.Info memory info = abi.decode(data, (FlashLoan.Info));

    uint256 _value;
    if (info.asset == _ETH) {
      // Convert WETH to ETH and assign amount to be set as msg.value
      _convertWethToEth(info.amount);
      _value = info.amount;
    } else {
      // Transfer to Vault the flashloan Amount
      // _value is 0
      IERC20(info.asset).univTransfer(payable(info.vault), info.amount);
    }

    _executeAction(info, info.amount, 2, _value);

    _approveBeforeRepay(info.asset == _ETH, info.asset, info.amount + 2, _dydxSoloMargin);
  }

  // ===================== Aave FlashLoan ===================================

  /**
   * @dev Initiates an Aave flashloan.
   * @param info: data to be passed between functions executing flashloan logic
   */
  function _initiateAaveFlashLoan(FlashLoan.Info calldata info) internal {
    //Initialize Instance of Aave Lending Pool
    IAaveLendingPool aaveLp = IAaveLendingPool(_aaveLendingPool);

    //Passing arguments to construct Aave flashloan -limited to 1 asset type for now.
    address receiverAddress = address(this);
    address[] memory assets = new address[](1);
    assets[0] = address(info.asset == _ETH ? _WETH : info.asset);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = info.amount;

    // 0 = no debt, 1 = stable, 2 = variable
    uint256[] memory modes = new uint256[](1);
    //modes[0] = 0;

    //address onBehalfOf = address(this);
    //bytes memory params = abi.encode(info);
    //uint16 referralCode = 0;

    //Aave Flashloan initiated.
    aaveLp.flashLoan(receiverAddress, assets, amounts, modes, address(this), abi.encode(info), 0);
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
  ) external override returns (bool) {
    require(msg.sender == _aaveLendingPool && initiator == address(this), Errors.VL_NOT_AUTHORIZED);

    FlashLoan.Info memory info = abi.decode(params, (FlashLoan.Info));

    uint256 _value;
    if (info.asset == _ETH) {
      // Convert WETH to ETH and assign amount to be set as msg.value
      _convertWethToEth(amounts[0]);
      _value = info.amount;
    } else {
      // Transfer to Vault the flashloan Amount
      // _value is 0
      IERC20(assets[0]).univTransfer(payable(info.vault), amounts[0]);
    }

    _executeAction(info, amounts[0], premiums[0], _value);

    //Approve aaveLP to spend to repay flashloan
    _approveBeforeRepay(info.asset == _ETH, assets[0], amounts[0] + premiums[0], _aaveLendingPool);

    return true;
  }

  // ===================== IronBank FlashLoan ===================================

  /**
   * @dev Initiates an IronBank flashloan.
   * @param info: data to be passed between functions executing flashloan logic
   */
  function _initiateCreamFlashLoan(FlashLoan.Info calldata info) internal {
    address token = info.asset == _ETH ? _WETH : info.asset;

    // Prepara data for flashloan execution
    bytes memory params = abi.encode(info);

    // Initialize Instance of IronBank LendingContract
    IERC3156FlashLender(_cyFlashloanLender).flashLoan(
      ICFlashloanReceiver(address(this)),
      token,
      info.amount,
      params
    );
  }

  /**
   * @dev Executes IronBank Flashloan, this operation is required
   * and called by IronBankflashloan when sending loaned amount
   */
  function onFlashLoan(
    address initiator,
    address token,
    uint256 amount,
    uint256 fee,
    bytes calldata params
  ) external override returns (bytes32) {
    require(
      address(this) == initiator && ICrComptroller(_cyComptroller).isMarketListed(msg.sender),
      Errors.VL_NOT_AUTHORIZED
    );
    require(IERC20(token).balanceOf(address(this)) >= amount, Errors.VL_FLASHLOAN_FAILED);

    FlashLoan.Info memory info = abi.decode(params, (FlashLoan.Info));

    uint256 _value;
    if (info.asset == _ETH) {
      // Convert WETH to _ETH and assign amount to be set as msg.value
      _convertWethToEth(amount);
      _value = amount;
    } else {
      // Transfer to Vault the flashloan Amount
      // _value is 0
      IERC20(token).univTransfer(payable(info.vault), amount);
    }

    // Do task according to CallType
    _executeAction(info, amount, fee, _value);

    if (info.asset == _ETH) _convertEthToWeth(amount + fee);
    // Transfer flashloan + fee back to crToken Lending Contract
    IERC20(token).univApprove(msg.sender, amount + fee);

    return keccak256("ERC3156FlashBorrowerInterface.onFlashLoan");
  }
  
  // ===================== Balancer FlashLoan ===================================
  
  /**
   * @dev Initiates a Balancer flashloan.
   * @param info: data to be passed between functions executing flashloan logic
   */
  function _initiateBalancerFlashLoan(FlashLoan.Info calldata info) internal {
    //Initialize Instance of Balancer Vault
    IBalancerVault balVault = IBalancerVault(_balancerVault);

    //Passing arguments to construct Balancer flashloan -limited to 1 asset type for now.
    IFlashLoanRecipient receiverAddress = IFlashLoanRecipient(address(this));
    IERC20[] memory assets = new IERC20[](1);
    assets[0] = IERC20(address(info.asset == _ETH ? _WETH : info.asset));
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = info.amount;

    //Balancer Flashloan initiated.
    balVault.flashLoan(receiverAddress, assets, amounts, abi.encode(info));
  }

  /**
   * @dev Executes Balancer Flashloan, this operation is required
   * and called by Balancer flashloan when sending loaned amount
   */
  function receiveFlashLoan(
    IERC20[] memory tokens,
    uint256[] memory amounts,
    uint256[] memory feeAmounts,
    bytes memory userData
  ) external override {
    require(msg.sender == _balancerVault, Errors.VL_NOT_AUTHORIZED);

    FlashLoan.Info memory info = abi.decode(userData, (FlashLoan.Info));

    uint256 _value;
    if (info.asset == _ETH) {
      // Convert WETH to ETH and assign amount to be set as msg.value
      _convertWethToEth(amounts[0]);
      _value = info.amount;
    } else {
      // Transfer to Vault the flashloan Amount
      // _value is 0
      tokens[0].univTransfer(payable(info.vault), amounts[0]);
    }

    _executeAction(info, amounts[0], feeAmounts[0], _value);

    // Repay flashloan
    _repay(
      info.asset == _ETH,
      address(tokens[0]),
      amounts[0] + feeAmounts[0],
      _balancerVault
    );
  }

  function _executeAction(
    FlashLoan.Info memory _info,
    uint256 _amount,
    uint256 _fee,
    uint256 _value
  ) internal {
    require( _paramsHash == keccak256(abi.encode(_info)), "False entry point!");
    if (_info.callType == FlashLoan.CallType.Switch) {
      IVault(_info.vault).executeSwitch{ value: _value }(_info.newProvider, _amount, _fee);
    } else if (_info.callType == FlashLoan.CallType.Close) {
      IFliquidator(_info.fliquidator).executeFlashClose{ value: _value }(
        _info.userAddrs[0],
        _info.vault,
        _amount,
        _fee
      );
    } else {
      IFliquidator(_info.fliquidator).executeFlashBatchLiquidation{ value: _value }(
        _info.userAddrs,
        _info.userBalances,
        _info.userliquidator,
        _info.vault,
        _amount,
        _fee
      );
    }
    _paramsHash = "";
  }

  function _approveBeforeRepay(
    bool _isETH,
    address _asset,
    uint256 _amount,
    address _spender
  ) internal {
    if (_isETH) {
      _convertEthToWeth(_amount);
      IERC20(_WETH).univApprove(payable(_spender), _amount);
    } else {
      IERC20(_asset).univApprove(payable(_spender), _amount);
    }
  }

  function _repay(
    bool _isETH,
    address _asset,
    uint256 _amount,
    address _spender
  ) internal {
    if (_isETH) {
      _convertEthToWeth(_amount);
      IERC20(_WETH).univTransfer(payable(_spender), _amount);
    } else {
      IERC20(_asset).univTransfer(payable(_spender), _amount);
    }
  }

  function _convertEthToWeth(uint256 _amount) internal {
    IWETH(_WETH).deposit{ value: _amount }();
  }

  function _convertWethToEth(uint256 _amount) internal {
    IWETH token = IWETH(_WETH);
    token.withdraw(_amount);
  }
}
