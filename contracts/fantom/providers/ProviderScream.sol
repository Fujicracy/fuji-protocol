// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/IProvider.sol";
import "../../interfaces/IUnwrapper.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IWETH.sol";
import "../../interfaces/IFujiMappings.sol";
import "../../interfaces/compound/IGenCToken.sol";
import "../../interfaces/compound/ICErc20.sol";
import "../../interfaces/compound/IComptroller.sol";
import "../libraries/LibUniversalERC20FTM.sol";

contract HelperFunct {
  function _isFTM(address token) internal pure returns (bool) {
    return (token == address(0) || token == address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF));
  }

  function _getMappingAddr() internal pure returns (address) {
    return 0xA9c29eA1a067740be6dB1F98FcbA0043C475041A; // Scream mapper
  }

  function _getComptrollerAddress() internal pure returns (address) {
    return 0x260E596DAbE3AFc463e75B6CC05d8c46aCAcFB09; // Scream comptroller fantom
  }

  function _getUnwrapper() internal pure returns(address) {
    return 0xee94A39D185329d8c46dEA726E01F91641E57346;
  }

  //Scream functions

  /**
   * @dev Approves vault's assets as collateral for Scream Protocol.
   * @param _cyTokenAddress: asset type to be approved as collateral.
   */
  function _enterCollatMarket(address _cyTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    IComptroller comptroller = IComptroller(_getComptrollerAddress());

    address[] memory cyTokenMarkets = new address[](1);
    cyTokenMarkets[0] = _cyTokenAddress;
    comptroller.enterMarkets(cyTokenMarkets);
  }

  /**
   * @dev Removes vault's assets as collateral for Scream Protocol.
   * @param _cyTokenAddress: asset type to be removed as collateral.
   */
  function _exitCollatMarket(address _cyTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    IComptroller comptroller = IComptroller(_getComptrollerAddress());

    comptroller.exitMarket(_cyTokenAddress);
  }
}

contract ProviderScream is IProvider, HelperFunct {
  using LibUniversalERC20FTM for IERC20;

  //Provider Core Functions

  /**
   * @dev Deposit '_asset'.
   * @param _asset: token address to deposit. (For FTM: 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
   * @param _amount: token amount to deposit.
   */
  function deposit(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    //Enter and/or ensure collateral market is enacted
    _enterCollatMarket(cyTokenAddr);

    if (_isFTM(_asset)) {
      // Transform ETH to WETH
      IWETH(0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83).deposit{ value: _amount }();
      _asset = address(0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83);
    }

    // Create reference to the ERC20 contract
    IERC20 erc20token = IERC20(_asset);

    // Create a reference to the cyToken contract
    ICErc20 cyToken = ICErc20(cyTokenAddr);

    //Checks, Vault balance of ERC20 to make deposit
    require(erc20token.balanceOf(address(this)) >= _amount, "Not enough Balance");

    //Approve to move ERC20tokens
    erc20token.univApprove(address(cyTokenAddr), _amount);

    // Scream Protocol mints cyTokens, trhow error if not
    require(cyToken.mint(_amount) == 0, "Deposit-failed");
  }

  /**
   * @dev Withdraw '_asset'.
   * @param _asset: token address to withdraw. (For FTM: 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
   * @param _amount: token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Create a reference to the corresponding cyToken contract
    IGenCToken cyToken = IGenCToken(cyTokenAddr);

    //Scream Protocol Redeem Process, throw errow if not.
    require(cyToken.redeemUnderlying(_amount) == 0, "Withdraw-failed");

    if (_isFTM(_asset)) {
      // Transform WFTM to FTM
      address unwrapper = _getUnwrapper();
      IERC20(0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Borrow '_asset'.
   * @param _asset token address to borrow.(For FTM: 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
   * @param _amount: token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Create a reference to the corresponding cyToken contract
    IGenCToken cyToken = IGenCToken(cyTokenAddr);

    //Enter and/or ensure collateral market is enacted
    //_enterCollatMarket(cyTokenAddr);

    //Scream Protocol Borrow Process, throw errow if not.
    require(cyToken.borrow(_amount) == 0, "borrow-failed");

    if (_isFTM(_asset)) {
      // Transform WFTM to FTM
      address unwrapper = _getUnwrapper();
      IERC20(0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Payback borrowed '_asset'.
   * @param _asset token address to payback.(For FTM: 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
   * @param _amount: token amount to payback.
   */
  function payback(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    if (_isFTM(_asset)) {
      // Transform FTM to WFTM
      IWETH(0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83).deposit{ value: _amount }();
      _asset = address(0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83);
    }

    // Create reference to the ERC20 contract
    IERC20 erc20token = IERC20(_asset);

    // Create a reference to the corresponding cyToken contract
    ICErc20 cyToken = ICErc20(cyTokenAddr);

    // Check there is enough balance to pay
    require(erc20token.balanceOf(address(this)) >= _amount, "Not-enough-token");
    erc20token.univApprove(address(cyTokenAddr), _amount);
    cyToken.repayBorrow(_amount);
  }

  /**
   * @dev Returns the current borrowing rate (APR) of '_asset', in ray(1e27).
   * @param _asset: token address to query the current borrowing rate.
   */
  function getBorrowRateFor(address _asset) external view override returns (uint256) {
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Block Rate transformed for common mantissa for Fuji in ray (1e27)
    // Note: Scream uses base 1e18
    uint256 bRateperBlock = IGenCToken(cyTokenAddr).borrowRatePerBlock() * 10**9;

    // The approximate number of blocks per year that is assumed by Scream interest rate model
    // ~60 blocks per min in fantom
    return bRateperBlock * 60 * 60 * 24 * 365;
  }

  /**
   * @dev Returns the borrow balance of '_asset' of caller.
   * NOTE: Returned value is at the last update state of provider.
   * @param _asset: token address to query the balance.
   */
  function getBorrowBalance(address _asset) external view override returns (uint256) {
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    return IGenCToken(cyTokenAddr).borrowBalanceStored(msg.sender);
  }

  /**
   * @dev Return borrow balance of '_asset' of caller.
   * This function updates the state of provider contract to return latest borrow balance.
   * It costs ~84K gas and is not a view function.
   * @param _asset token address to query the balance.
   * @param _who address of the account.
   */
  function getBorrowBalanceOf(address _asset, address _who) external override returns (uint256) {
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    return IGenCToken(cyTokenAddr).borrowBalanceCurrent(_who);
  }

  /**
   * @dev Returns the deposit balance of '_asset' of caller.
   * @param _asset: token address to query the balance.
   */
  function getDepositBalance(address _asset) external view override returns (uint256) {
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);
    uint256 cyTokenBal = IGenCToken(cyTokenAddr).balanceOf(msg.sender);
    uint256 exRate = IGenCToken(cyTokenAddr).exchangeRateStored();

    return (exRate * cyTokenBal) / 1e18;
  }
}
