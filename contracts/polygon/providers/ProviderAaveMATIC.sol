// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/IProvider.sol";
import "../../interfaces/IUnwrapper.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IWETH.sol";
import "../../interfaces/aave/IAaveDataProvider.sol";
import "../../interfaces/aave/IAaveLendingPool.sol";
import "../../interfaces/aave/IAaveLendingPoolProvider.sol";
import "../../libraries/LibUniversalERC20.sol";

contract ProviderAaveMATIC is IProvider {
  using LibUniversalERC20 for IERC20;

  function _getAaveProvider() internal pure returns (IAaveLendingPoolProvider) {
    return IAaveLendingPoolProvider(0xd05e3E715d945B59290df0ae8eF85c1BdB684744);
  }

  function _getAaveDataProvider() internal pure returns (IAaveDataProvider) {
    return IAaveDataProvider(0x7551b5D2763519d4e37e8B81929D336De671d46d);
  }

  function _getWmaticAddr() internal pure returns (address) {
    return 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
  }

  function _getMaticAddr() internal pure returns (address) {
    return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
  }

  function _getUnwrapper() internal pure returns (address) {
    return 0x03E074BB834F7C4940dFdE8b29e63584b3dE3a87;
  }

  /**
   * @dev Return the borrowing rate of ETH/ERC20_Token.
   * @param _asset to query the borrowing rate.
   */
  function getBorrowRateFor(address _asset) external view override returns (uint256) {
    IAaveDataProvider aaveData = _getAaveDataProvider();

    (, , , , uint256 variableBorrowRate, , , , , ) = IAaveDataProvider(aaveData).getReserveData(
      _asset == _getMaticAddr() ? _getWmaticAddr() : _asset
    );

    return variableBorrowRate;
  }

  /**
   * @dev Return borrow balance of ETH/ERC20_Token.
   * @param _asset token address to query the balance.
   */
  function getBorrowBalance(address _asset) external view override returns (uint256) {
    IAaveDataProvider aaveData = _getAaveDataProvider();

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
    IAaveDataProvider aaveData = _getAaveDataProvider();

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
    IAaveDataProvider aaveData = _getAaveDataProvider();

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
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());

    bool isEth = _asset == _getMaticAddr();
    address _tokenAddr = isEth ? _getWmaticAddr() : _asset;

    // convert ETH to WETH
    if (isEth) IWETH(_tokenAddr).deposit{ value: _amount }();

    IERC20(_tokenAddr).univApprove(address(aave), _amount);

    aave.deposit(_tokenAddr, _amount, address(this), 0);

    aave.setUserUseReserveAsCollateral(_tokenAddr, true);
  }

  /**
   * @dev Borrow ETH/ERC20_Token.
   * @param _asset token address to borrow.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());

    bool isEth = _asset == _getMaticAddr();
    address _tokenAddr = isEth ? _getWmaticAddr() : _asset;

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
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());

    bool isEth = _asset == _getMaticAddr();
    address _tokenAddr = isEth ? _getWmaticAddr() : _asset;

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
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());

    bool isEth = _asset == _getMaticAddr();
    address _tokenAddr = isEth ? _getWmaticAddr() : _asset;

    // convert ETH to WETH
    if (isEth) IWETH(_tokenAddr).deposit{ value: _amount }();

    IERC20(_tokenAddr).univApprove(address(aave), _amount);

    aave.repay(_tokenAddr, _amount, 2, address(this));
  }
}
