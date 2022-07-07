// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibUniversalERC20FTM.sol";
import "../../interfaces/IProvider.sol";
import "../../interfaces/IUnwrapper.sol";
import "../../interfaces/IWETH.sol";

import "../../interfaces/aavev3/IAaveProtocolDataProvider.sol";
import "../../interfaces/aavev3/IPool.sol";


contract ProviderAaveV3FTM is IProvider {
  using LibUniversalERC20FTM for IERC20;

  function _getAaveProtocolDataProvider() internal pure returns (IAaveProtocolDataProvider) {
    return IAaveProtocolDataProvider(0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654);
  }

  function _getPool() internal pure returns (IPool) {
    return IPool(0x794a61358D6845594F94dc1DB02A252b5b4814aD);
  }

  function _getWrappedNativeAddr() internal pure returns (address) {
    return 0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83;
  }

  function _getNativeAddr() internal pure returns (address) {
    return 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
  }

  function _getUnwrapper() internal pure returns (address) {
    return 0xee94A39D185329d8c46dEA726E01F91641E57346;
  }

  /**
   * @dev Return the borrowing rate of Native/ERC20_Token.
   * @param _asset to query the borrowing rate.
   */
  function getBorrowRateFor(address _asset) external view override returns (uint256) {
    IAaveProtocolDataProvider aaveData = _getAaveProtocolDataProvider();

    (, , , , , , uint256 variableBorrowRate, , , , , ) = aaveData.getReserveData(
      _asset == _getNativeAddr() ? _getWrappedNativeAddr() : _asset
    );

    return variableBorrowRate;
  }

  /**
   * @dev Return borrow balance of Native/ERC20_Token.
   * @param _asset token address to query the balance.
   */
  function getBorrowBalance(address _asset) external view override returns (uint256) {
    IAaveProtocolDataProvider aaveData = _getAaveProtocolDataProvider();

    bool isEth = _asset == _getNativeAddr();
    address _tokenAddr = isEth ? _getWrappedNativeAddr() : _asset;

    (, , uint256 variableDebt, , , , , , ) = aaveData.getUserReserveData(_tokenAddr, msg.sender);

    return variableDebt;
  }

  /**
   * @dev Return borrow balance of Native/ERC20_Token.
   * @param _asset token address to query the balance.
   * @param _who address of the account.
   */
  function getBorrowBalanceOf(address _asset, address _who)
    external
    view
    override
    returns (uint256)
  {
    IAaveProtocolDataProvider aaveData = _getAaveProtocolDataProvider();

    bool isEth = _asset == _getNativeAddr();
    address _tokenAddr = isEth ? _getWrappedNativeAddr() : _asset;

    (, , uint256 variableDebt, , , , , , ) = aaveData.getUserReserveData(_tokenAddr, _who);

    return variableDebt;
  }

  /**
   * @dev Return deposit balance of Native/ERC20_Token.
   * @param _asset token address to query the balance.
   */
  function getDepositBalance(address _asset) external view override returns (uint256) {
    IAaveProtocolDataProvider aaveData = _getAaveProtocolDataProvider();

    bool isEth = _asset == _getNativeAddr();
    address _tokenAddr = isEth ? _getWrappedNativeAddr() : _asset;

    (uint256 atokenBal, , , , , , , , ) = aaveData.getUserReserveData(_tokenAddr, msg.sender);

    return atokenBal;
  }

  /**
   * @dev Deposit Native/ERC20_Token.
   * @param _asset token address to deposit.(For Native: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount token amount to deposit.
   */
  function deposit(address _asset, uint256 _amount) external payable override {
    IPool aave = _getPool();

    bool isEth = _asset == _getNativeAddr();
    address _tokenAddr = isEth ? _getWrappedNativeAddr() : _asset;

    // convert ETH to WETH
    if (isEth) IWETH(_tokenAddr).deposit{ value: _amount }();

    IERC20(_tokenAddr).univApprove(address(aave), _amount);

    aave.supply(_tokenAddr, _amount, address(this), 0);

    aave.setUserUseReserveAsCollateral(_tokenAddr, true);
  }

  /**
   * @dev Borrow Native/ERC20_Token.
   * @param _asset token address to borrow.(For Native: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    IPool aave = _getPool();

    bool isEth = _asset == _getNativeAddr();
    address _tokenAddr = isEth ? _getWrappedNativeAddr() : _asset;

    aave.borrow(_tokenAddr, _amount, 2, 0, address(this));

    // convert Wrapped Native to Native
    if (isEth) {
      address unwrapper = _getUnwrapper();
      IERC20(_tokenAddr).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Withdraw Native/ERC20_Token.
   * @param _asset token address to withdraw.
   * @param _amount token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
    IPool aave = _getPool();

    bool isEth = _asset == _getNativeAddr();
    address _tokenAddr = isEth ? _getWrappedNativeAddr() : _asset;

    aave.withdraw(_tokenAddr, _amount, address(this));

    // convert Wrapped Native to Native
    if (isEth) {
      address unwrapper = _getUnwrapper();
      IERC20(_tokenAddr).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Payback borrowed Native/ERC20_Token.
   * @param _asset token address to payback.
   * @param _amount token amount to payback.
   */

  function payback(address _asset, uint256 _amount) external payable override {
    IPool aave = _getPool();

    bool isEth = _asset == _getNativeAddr();
    address _tokenAddr = isEth ? _getWrappedNativeAddr() : _asset;

    // convert ETH to WETH
    if (isEth) IWETH(_tokenAddr).deposit{ value: _amount }();

    IERC20(_tokenAddr).univApprove(address(aave), _amount);

    aave.repay(_tokenAddr, _amount, 2, address(this));
  }
}