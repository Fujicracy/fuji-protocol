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
import "../libraries/LibUniversalERC20FTM.sol";

contract ProviderGeist is IProvider {
  using LibUniversalERC20FTM for IERC20;

  function _getAaveProvider() internal pure returns (IAaveLendingPoolProvider) {
    return IAaveLendingPoolProvider(0x6c793c628Fe2b480c5e6FB7957dDa4b9291F9c9b);
  }

  function _getAaveDataProvider() internal pure returns (IAaveDataProvider) {
    return IAaveDataProvider(0xf3B0611e2E4D2cd6aB4bb3e01aDe211c3f42A8C3);
  }

  function _getWftmAddr() internal pure returns (address) {
    return 0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83;
  }

  function _getFtmAddr() internal pure returns (address) {
    return 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
  }

  function _getUnwrapper() internal pure returns (address) {
    return 0xee94A39D185329d8c46dEA726E01F91641E57346;
  }

  /**
   * @dev Return the borrowing rate of '_asset'.
   * @param _asset to query the borrowing rate.
   */
  function getBorrowRateFor(address _asset) external view override returns (uint256) {
    IAaveDataProvider aaveData = _getAaveDataProvider();

    (, , , , uint256 variableBorrowRate, , , , , ) = IAaveDataProvider(aaveData).getReserveData(
      _asset == _getFtmAddr() ? _getWftmAddr() : _asset
    );

    return variableBorrowRate;
  }

  /**
   * @dev Return borrow balance of '_asset'.
   * @param _asset token address to query the balance.
   */
  function getBorrowBalance(address _asset) external view override returns (uint256) {
    IAaveDataProvider aaveData = _getAaveDataProvider();

    bool isFtm = _asset == _getFtmAddr();
    address _tokenAddr = isFtm ? _getWftmAddr() : _asset;

    (, , uint256 variableDebt, , , , , , ) = aaveData.getUserReserveData(_tokenAddr, msg.sender);

    return variableDebt;
  }

  /**
   * @dev Return borrow balance of '_asset'.
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

    bool isFtm = _asset == _getFtmAddr();
    address _tokenAddr = isFtm ? _getWftmAddr() : _asset;

    (, , uint256 variableDebt, , , , , , ) = aaveData.getUserReserveData(_tokenAddr, _who);

    return variableDebt;
  }

  /**
   * @dev Return deposit balance of '_asset'.
   * @param _asset token address to query the balance.
   */
  function getDepositBalance(address _asset) external view override returns (uint256) {
    IAaveDataProvider aaveData = _getAaveDataProvider();

    bool isFtm = _asset == _getFtmAddr();
    address _tokenAddr = isFtm ? _getWftmAddr() : _asset;

    (uint256 atokenBal, , , , , , , , ) = aaveData.getUserReserveData(_tokenAddr, msg.sender);

    return atokenBal;
  }

  /**
   * @dev Deposit '_asset'.
   * @param _asset token address to deposit.(For FTM: 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
   * @param _amount token amount to deposit.
   */
  function deposit(address _asset, uint256 _amount) external payable override {
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());

    bool isFtm = _asset == _getFtmAddr();
    address _tokenAddr = isFtm ? _getWftmAddr() : _asset;

    // convert FTM to WFTM
    if (isFtm) IWETH(_tokenAddr).deposit{ value: _amount }();

    IERC20(_tokenAddr).univApprove(address(aave), _amount);

    aave.deposit(_tokenAddr, _amount, address(this), 0);

    aave.setUserUseReserveAsCollateral(_tokenAddr, true);
  }

  /**
   * @dev Borrow '_asset'.
   * @param _asset token address to borrow.(For FTM: 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
   * @param _amount token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());

    bool isFtm = _asset == _getFtmAddr();
    address _tokenAddr = isFtm ? _getWftmAddr() : _asset;

    aave.borrow(_tokenAddr, _amount, 2, 0, address(this));

    // convert WFTM to FTM
    if (isFtm) {
      address unwrapper = _getUnwrapper();
      IERC20(_tokenAddr).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Withdraw '_asset'.
   * @param _asset token address to withdraw.
   * @param _amount token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());

    bool isFtm = _asset == _getFtmAddr();
    address _tokenAddr = isFtm ? _getWftmAddr() : _asset;

    aave.withdraw(_tokenAddr, _amount, address(this));

    // convert WFTM to FTM
    if (isFtm) {
      address unwrapper = _getUnwrapper();
      IERC20(_tokenAddr).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Payback borrowed '_asset'.
   * @param _asset token address to payback.
   * @param _amount token amount to payback.
   */

  function payback(address _asset, uint256 _amount) external payable override {
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());

    bool isFtm = _asset == _getFtmAddr();
    address _tokenAddr = isFtm ? _getWftmAddr() : _asset;

    // convert FTM to WFTM
    if (isFtm) IWETH(_tokenAddr).deposit{ value: _amount }();

    IERC20(_tokenAddr).univApprove(address(aave), _amount);

    aave.repay(_tokenAddr, _amount, 2, address(this));
  }
}
