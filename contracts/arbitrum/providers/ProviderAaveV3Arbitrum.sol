// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../libraries/LibUniversalERC20.sol";
import "../../interfaces/IProvider.sol";
import "../../interfaces/IUnwrapper.sol";
import "../../interfaces/IWETH.sol";

import "../../interfaces/aavev3/IAaveProtocolDataProvider.sol";
import "../../interfaces/aavev3/IPool.sol";

contract ProviderAaveV3Arbitrum is IProvider {
  using LibUniversalERC20 for IERC20;

  function _getAaveProtocolDataProvider() internal pure returns (IAaveProtocolDataProvider) {
    return IAaveProtocolDataProvider(0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654);
  }

  function _getPool() internal pure returns (IPool) {
    return IPool(0x794a61358D6845594F94dc1DB02A252b5b4814aD);
  }

  function _getWethAddr() internal pure returns (address) {
    return 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
  }

  function _getEthAddr() internal pure returns (address) {
    return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
  }

  function _getUnwrapper() internal pure returns (address) {
    return 0xb55eC0208a7C1727544852EbFE34BFF34B5fe6e4;
  }

  /**
   * @dev Return the borrowing rate of ETH/ERC20_Token.
   * @param _asset to query the borrowing rate.
   */
  function getBorrowRateFor(address _asset) external view override returns (uint256) {
    IAaveProtocolDataProvider aaveData = _getAaveProtocolDataProvider();

    (, , , , , , uint256 variableBorrowRate, , , , , ) = aaveData.getReserveData(
      _asset == _getEthAddr() ? _getWethAddr() : _asset
    );

    return variableBorrowRate;
  }

  /**
   * @dev Return borrow balance of ETH/ERC20_Token.
   * @param _asset token address to query the balance.
   */
  function getBorrowBalance(address _asset) external view override returns (uint256) {
    IAaveProtocolDataProvider aaveData = _getAaveProtocolDataProvider();

    bool isEth = _asset == _getEthAddr();
    address _tokenAddr = isEth ? _getWethAddr() : _asset;

    (, , uint256 variableDebt, , , , , , ) = aaveData.getUserReserveData(_tokenAddr, msg.sender);

    return variableDebt;
  }

  /**
   * @dev Return borrow balance of ETH/ERC20_Token.
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

    bool isEth = _asset == _getEthAddr();
    address _tokenAddr = isEth ? _getWethAddr() : _asset;

    (, , uint256 variableDebt, , , , , , ) = aaveData.getUserReserveData(_tokenAddr, _who);

    return variableDebt;
  }

  /**
   * @dev Return deposit balance of ETH/ERC20_Token.
   * @param _asset token address to query the balance.
   */
  function getDepositBalance(address _asset) external view override returns (uint256) {
    IAaveProtocolDataProvider aaveData = _getAaveProtocolDataProvider();

    bool isEth = _asset == _getEthAddr();
    address _tokenAddr = isEth ? _getWethAddr() : _asset;

    (uint256 atokenBal, , , , , , , , ) = aaveData.getUserReserveData(_tokenAddr, msg.sender);

    return atokenBal;
  }

  /**
   * @dev Deposit ETH/ERC20_Token.
   * @param _asset token address to deposit.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount token amount to deposit.
   */
  function deposit(address _asset, uint256 _amount) external payable override {
    IPool aave = _getPool();

    bool isEth = _asset == _getEthAddr();
    address _tokenAddr = isEth ? _getWethAddr() : _asset;

    // convert ETH to WETH
    if (isEth) IWETH(_tokenAddr).deposit{ value: _amount }();

    IERC20(_tokenAddr).univApprove(address(aave), _amount);

    aave.supply(_tokenAddr, _amount, address(this), 0);

    aave.setUserUseReserveAsCollateral(_tokenAddr, true);
  }

  /**
   * @dev Borrow ETH/ERC20_Token.
   * @param _asset token address to borrow.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    IPool aave = _getPool();

    bool isEth = _asset == _getEthAddr();
    address _tokenAddr = isEth ? _getWethAddr() : _asset;

    aave.borrow(_tokenAddr, _amount, 2, 0, address(this));

    // convert WETH to ETH
    if (isEth) {
      address unwrapper = _getUnwrapper();
      IERC20(_tokenAddr).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Withdraw ETH/ERC20_Token.
   * @param _asset token address to withdraw.
   * @param _amount token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
    IPool aave = _getPool();

    bool isEth = _asset == _getEthAddr();
    address _tokenAddr = isEth ? _getWethAddr() : _asset;

    aave.withdraw(_tokenAddr, _amount, address(this));

    // convert WETH to ETH
    if (isEth) {
      address unwrapper = _getUnwrapper();
      IERC20(_tokenAddr).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Payback borrowed ETH/ERC20_Token.
   * @param _asset token address to payback.
   * @param _amount token amount to payback.
   */

  function payback(address _asset, uint256 _amount) external payable override {
    IPool aave = _getPool();

    bool isEth = _asset == _getEthAddr();
    address _tokenAddr = isEth ? _getWethAddr() : _asset;

    // convert ETH to WETH
    if (isEth) IWETH(_tokenAddr).deposit{ value: _amount }();

    IERC20(_tokenAddr).univApprove(address(aave), _amount);

    aave.repay(_tokenAddr, _amount, 2, address(this));
  }
}
