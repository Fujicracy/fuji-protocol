// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../abstracts/claimable/Claimable.sol";
import "../../interfaces/IFujiAdmin.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IFlasher.sol";
import "../../interfaces/IFliquidator.sol";
import "../../interfaces/IWETH.sol";
import "../../libraries/FlashLoans.sol";
import "../../libraries/Errors.sol";
import "../../interfaces/balancer/IBalancerVault.sol";
import "../../interfaces/balancer/IFlashLoanRecipient.sol";
import "../../interfaces/aavev3/IFlashLoanSimpleReceiver.sol";
import "../../interfaces/aavev3/IPool.sol";
import "../../libraries/LibUniversalERC20.sol";

/**
 * @dev Contract that handles Fuji protocol flash loan logic and
 * the specific logic of all active flash loan providers used by Fuji protocol.
 */

contract FlasherArbitrum is IFlasher, Claimable, IFlashLoanRecipient, IFlashLoanSimpleReceiver {
  using LibUniversalERC20 for IERC20;

  IFujiAdmin private _fujiAdmin;

  address private constant _ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
  address private constant _WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

  address private immutable _balancerVault = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
  address private immutable _aaveV3Pool = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;

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
    if (_flashnum == 3) {
      _initiateBalancerFlashLoan(info);
    } else if (_flashnum == 4) {
      _initiateAaveV3FlashLoan(info);
    } else {
      revert(Errors.VL_INVALID_FLASH_NUMBER);
    }
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
    _repay(info.asset == _ETH, address(tokens[0]), amounts[0] + feeAmounts[0], _balancerVault);
  }

  // ===================== AaveV3 FlashLoan ===================================

  /**
   * @dev Initiates an AaveV3 flashloan.
   * @param info: data to be passed between functions executing flashloan logic
   */
  function _initiateAaveV3FlashLoan(FlashLoan.Info calldata info) internal {
    //Initialize Instance of AaveV3 Lending Pool
    IPool aave = IPool(_aaveV3Pool);

    //Passing arguments to construct AaveV3 flashloan
    address receiverAddress = address(this);
    address asset = info.asset == _ETH ? _WETH : info.asset;
    uint256 amount = info.amount;

    //AaveV3 Flashloan initiated.
    aave.flashLoanSimple(receiverAddress, asset, amount, abi.encode(info), 0);
  }

  /**
   * @dev Executes AaveV3 Flashloan, this operation is required
   * and called by Aavev3flashloan when sending loaned amount
   */
  function executeOperation(
    address asset,
    uint256 amount,
    uint256 premium,
    address initiator,
    bytes calldata params
  ) external override returns (bool) {
    require(msg.sender == _aaveV3Pool && initiator == address(this), Errors.VL_NOT_AUTHORIZED);

    FlashLoan.Info memory info = abi.decode(params, (FlashLoan.Info));

    uint256 _value;
    if (info.asset == _ETH) {
      // Convert WETH to ETH and assign amount to be set as msg.value
      _convertWethToEth(amount);
      _value = info.amount;
    } else {
      // Transfer to Vault the flashloan Amount
      // _value is 0
      IERC20(asset).univTransfer(payable(info.vault), amount);
    }

    _executeAction(info, amount, premium, _value);

    //Approve aavev3LP to spend to repay flashloan
    _approveBeforeRepay(
      info.asset == _ETH,
      asset,
      amount + premium,
      _aaveV3Pool
    );

    return true;
  }

  function _executeAction(
    FlashLoan.Info memory _info,
    uint256 _amount,
    uint256 _fee,
    uint256 _value
  ) internal {
    require(_paramsHash == keccak256(abi.encode(_info)), "False entry point!");
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
