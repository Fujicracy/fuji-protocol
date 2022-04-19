// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibUniversalERC20MATIC.sol";
import "../../interfaces/IProvider.sol";
import "../../interfaces/IWETH.sol";

import "../../interfaces/aavev3/IPoolAddressProvider.sol";
import "../../interfaces/aavev3/IAaveProtocolDataProvider.sol";
import "../../interfaces/aavev3/IPool.sol";


contract ProviderAaveV3MATIC is IProvider {
  using LibUniversalERC20MATIC for IERC20;

  function _getPoolAddressProvider() internal pure returns (IPoolAddressProvider) {
    return IPoolAddressProvider(0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb);
  }

  function _getWmaticAddr() internal pure returns (address) {
    return 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
  }

  function _getMaticAddr() internal pure returns (address) {
    return 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
  }

  /**
   * @dev Return the borrowing rate of ETH/ERC20_Token.
   * @param _asset to query the borrowing rate.
   */
  function getBorrowRateFor(address _asset) external view override returns (uint256) {
    IAaveProtocolDataProvider aaveData = IAaveProtocolDataProvider(_getPoolAddressProvider().getPoolDataProvider());

    (, , , , uint256 variableBorrowRate, , , , , , , ) = aaveData.getReserveData(
      _asset == _getMaticAddr() ? _getWmaticAddr() : _asset
    );

    return variableBorrowRate;
  }

  /**
   * @dev Return borrow balance of ETH/ERC20_Token.
   * @param _asset token address to query the balance.
   */
  function getBorrowBalance(address _asset) external view override returns (uint256) {
    IAaveProtocolDataProvider aaveData = IAaveProtocolDataProvider(_getPoolAddressProvider().getPoolDataProvider());

    bool isEth = _asset == _getMaticAddr();
    address _tokenAddr = isEth ? _getWmaticAddr() : _asset;

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
    IAaveProtocolDataProvider aaveData = IAaveProtocolDataProvider(_getPoolAddressProvider().getPoolDataProvider());

    bool isEth = _asset == _getMaticAddr();
    address _tokenAddr = isEth ? _getWmaticAddr() : _asset;

    (, , uint256 variableDebt, , , , , , ) = aaveData.getUserReserveData(_tokenAddr, _who);

    return variableDebt;
  }

  /**
   * @dev Return deposit balance of ETH/ERC20_Token.
   * @param _asset token address to query the balance.
   */
  function getDepositBalance(address _asset) external view override returns (uint256) {
    IAaveProtocolDataProvider aaveData = IAaveProtocolDataProvider(_getPoolAddressProvider().getPoolDataProvider());

    bool isEth = _asset == _getMaticAddr();
    address _tokenAddr = isEth ? _getWmaticAddr() : _asset;

    (uint256 atokenBal, , , , , , , , ) = aaveData.getUserReserveData(_tokenAddr, msg.sender);

    return atokenBal;
  }

  /**
   * @dev Deposit ETH/ERC20_Token.
   * @param _asset token address to deposit.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount token amount to deposit.
   */
  function deposit(address _asset, uint256 _amount) external payable override {
    IPool aave = IPool(_getPoolAddressProvider().getPool());

    bool isEth = _asset == _getMaticAddr();
    address _tokenAddr = isEth ? _getWmaticAddr() : _asset;

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
  }

  /**
   * @dev Withdraw ETH/ERC20_Token.
   * @param _asset token address to withdraw.
   * @param _amount token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
  }

  /**
   * @dev Payback borrowed ETH/ERC20_Token.
   * @param _asset token address to payback.
   * @param _amount token amount to payback.
   */

  function payback(address _asset, uint256 _amount) external payable override {
  }
}