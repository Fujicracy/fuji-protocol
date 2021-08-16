// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../Interfaces/IProvider.sol";
import "../Interfaces/ITokenInterface.sol";
import "../Interfaces/Aave/IAaveDataProvider.sol";
import "../Interfaces/Aave/IAaveLendingPool.sol";
import "../Interfaces/Aave/IAaveLendingPoolProvider.sol";
import "../Libraries/LibUniversalERC20.sol";

contract ProviderAave is IProvider {
  using LibUniversalERC20 for IERC20;

  function _getAaveProvider() internal pure returns (IAaveLendingPoolProvider) {
    return IAaveLendingPoolProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5); //mainnet
  }

  function _getAaveDataProvider() internal pure returns (IAaveDataProvider) {
    return IAaveDataProvider(0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d); //mainnet
  }

  function _getWethAddr() internal pure returns (address) {
    return 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // Mainnet WETH Address
  }

  function _getEthAddr() internal pure returns (address) {
    return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE; // ETH Address
  }

  function _getIsColl(
    IAaveDataProvider _aaveData,
    address _token,
    address _user
  ) internal view returns (bool isCol) {
    (, , , , , , , , isCol) = _aaveData.getUserReserveData(_token, _user);
  }

  function _convertEthToWeth(
    bool _isEth,
    ITokenInterface _token,
    uint256 _amount
  ) internal {
    if (_isEth) _token.deposit{ value: _amount }();
  }

  function _convertWethToEth(
    bool _isEth,
    ITokenInterface _token,
    uint256 _amount
  ) internal {
    if (_isEth) {
      _token.approve(address(_token), _amount);
      _token.withdraw(_amount);
    }
  }

  /**
   * @dev Return the borrowing rate of ETH/ERC20_Token.
   * @param _asset to query the borrowing rate.
   */
  function getBorrowRateFor(address _asset) external view override returns (uint256) {
    IAaveDataProvider aaveData = _getAaveDataProvider();

    (, , , , uint256 variableBorrowRate, , , , , ) = IAaveDataProvider(aaveData)
    .getReserveData(_asset == _getEthAddr() ? _getWethAddr() : _asset);

    return variableBorrowRate;
  }

  /**
   * @dev Return borrow balance of ETH/ERC20_Token.
   * @param _asset token address to query the balance.
   */
  function getBorrowBalance(address _asset) external view override returns (uint256) {
    IAaveDataProvider aaveData = _getAaveDataProvider();

    bool isEth = _asset == _getEthAddr();
    address _token = isEth ? _getWethAddr() : _asset;

    (, , uint256 variableDebt, , , , , , ) = aaveData.getUserReserveData(_token, msg.sender);

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

    bool isEth = _asset == _getEthAddr();
    address _token = isEth ? _getWethAddr() : _asset;

    (, , uint256 variableDebt, , , , , , ) = aaveData.getUserReserveData(_token, _who);

    return variableDebt;
  }

  /**
   * @dev Return deposit balance of ETH/ERC20_Token.
   * @param _asset token address to query the balance.
   */
  function getDepositBalance(address _asset) external view override returns (uint256) {
    IAaveDataProvider aaveData = _getAaveDataProvider();

    bool isEth = _asset == _getEthAddr();
    address _token = isEth ? _getWethAddr() : _asset;

    (uint256 atokenBal, , , , , , , , ) = aaveData.getUserReserveData(_token, msg.sender);

    return atokenBal;
  }

  /**
   * @dev Deposit ETH/ERC20_Token.
   * @param _asset token address to deposit.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount token amount to deposit.
   */
  function deposit(address _asset, uint256 _amount) external payable override {
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());
    IAaveDataProvider aaveData = _getAaveDataProvider();

    bool isEth = _asset == _getEthAddr();
    address _token = isEth ? _getWethAddr() : _asset;

    ITokenInterface tokenContract = ITokenInterface(_token);

    if (isEth) {
      _amount = _amount == type(uint256).max ? address(this).balance : _amount;
      _convertEthToWeth(isEth, tokenContract, _amount);
    } else {
      _amount = _amount == type(uint256).max ? tokenContract.balanceOf(address(this)) : _amount;
    }

    tokenContract.approve(address(aave), _amount);

    aave.deposit(_token, _amount, address(this), 0);

    if (!_getIsColl(aaveData, _token, address(this))) {
      aave.setUserUseReserveAsCollateral(_token, true);
    }
  }

  /**
   * @dev Borrow ETH/ERC20_Token.
   * @param _asset token address to borrow.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());

    bool isEth = _asset == _getEthAddr();
    address _token = isEth ? _getWethAddr() : _asset;

    aave.borrow(_token, _amount, 2, 0, address(this));
    _convertWethToEth(isEth, ITokenInterface(_token), _amount);
  }

  /**
   * @dev Withdraw ETH/ERC20_Token.
   * @param _asset token address to withdraw.
   * @param _amount token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());

    bool isEth = _asset == _getEthAddr();
    address _token = isEth ? _getWethAddr() : _asset;

    ITokenInterface tokenContract = ITokenInterface(_token);
    uint256 initialBal = tokenContract.balanceOf(address(this));

    aave.withdraw(_token, _amount, address(this));
    uint256 finalBal = tokenContract.balanceOf(address(this));
    _amount = finalBal - initialBal;

    _convertWethToEth(isEth, tokenContract, _amount);
  }

  /**
   * @dev Payback borrowed ETH/ERC20_Token.
   * @param _asset token address to payback.
   * @param _amount token amount to payback.
   */

  function payback(address _asset, uint256 _amount) external payable override {
    IAaveLendingPool aave = IAaveLendingPool(_getAaveProvider().getLendingPool());
    IAaveDataProvider aaveData = _getAaveDataProvider();

    bool isEth = _asset == _getEthAddr();
    address _token = isEth ? _getWethAddr() : _asset;

    ITokenInterface tokenContract = ITokenInterface(_token);

    (, , uint256 variableDebt, , , , , , ) = aaveData.getUserReserveData(_token, address(this));
    _amount = _amount == type(uint256).max ? variableDebt : _amount;

    if (isEth) _convertEthToWeth(isEth, tokenContract, _amount);

    tokenContract.approve(address(aave), _amount);

    aave.repay(_token, _amount, 2, address(this));
  }
}
