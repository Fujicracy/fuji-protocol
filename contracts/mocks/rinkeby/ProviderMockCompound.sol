// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/IProvider.sol";
import "../../interfaces/IUnwrapper.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IWETH.sol";
import "../../interfaces/IFujiMappings.sol";
import "../../interfaces/compound/IGenCToken.sol";
import "../../interfaces/compound/ICEth.sol";
import "../../interfaces/compound/ICErc20.sol";
import "../../interfaces/compound/IComptroller.sol";
import "../../interfaces/compound/IProxyReceiver.sol";
import "../../mainnet/libraries/LibUniversalERC20.sol";

contract HelperFunct {
  function _isNative(address token) internal pure returns (bool) {
    return (token == address(0) || token == address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF));
  }

  function _getMappingAddr() internal pure returns (address) {
    return 0x2F44D08050ada97bB8D06F42d2C588406f69bf93; // Compound Rinkeby mapper
  }

  function _getComptrollerAddress() internal pure returns (address) {
    return 0x2EAa9D77AE4D8f9cdD9FAAcd44016E746485bddb; // Compound Rinkeby
  }

  function _getUnwrapper() internal pure returns (address) {
    return 0xaa37e04bB9C0fe9d585E065eC7Ea27328Dca0e08; // Rinkeby
  }

  function _getProxyReceiver() internal pure returns (address) {
    return 0x51A24fbdb77A576D440FCC1B82C8a1EADf2729E0; // Rinkeby
  }


  /**
   * @dev Approves vault's assets as collateral for Compound-Like Protocol.
   * @param _cTokenAddress: asset type to be approved as collateral.
   */
  function _enterCollatMarket(address _cTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    IComptroller comptroller = IComptroller(_getComptrollerAddress());

    address[] memory cTokenMarkets = new address[](1);
    cTokenMarkets[0] = _cTokenAddress;
    comptroller.enterMarkets(cTokenMarkets);
  }

  /**
   * @dev Removes vault's assets as collateral for Compound-Like Protocol.
   * @param _cTokenAddress: asset type to be removed as collateral.
   */
  function _exitCollatMarket(address _cTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    IComptroller comptroller = IComptroller(_getComptrollerAddress());

    comptroller.exitMarket(_cTokenAddress);
  }
}

contract ProviderMockCompound is IProvider, HelperFunct {
  using LibUniversalERC20 for IERC20;

  // Provider Core Functions

  /**
   * @dev Deposit '_asset'.
   * @param _asset: token address to deposit. (For Native: 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
   * @param _amount: token amount to deposit.
   */
  function deposit(address _asset, uint256 _amount) external payable override {
    // Get cToken address from mapping
    address cTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Enter and/or ensure collateral market is enacted
    _enterCollatMarket(cTokenAddr);

    if (_isNative(_asset)) {
      // Create a reference to the cToken contract
      ICEth cToken = ICEth(cTokenAddr);

      // Compound protocol Mints cTokens, ETH method
      cToken.mint{ value: _amount }();
    } else {
      // Create reference to the ERC20 contract
      IERC20 erc20token = IERC20(_asset);

      // Create a reference to the cToken contract
      ICErc20 cToken = ICErc20(cTokenAddr);

      // Checks, Vault balance of ERC20 to make deposit
      require(erc20token.balanceOf(address(this)) >= _amount, "Not enough Balance");

      // Approve to move ERC20tokens
      erc20token.univApprove(address(cTokenAddr), _amount);

      // Compound Protocol mints cTokens, trhow error if not
      require(cToken.mint(_amount) == 0, "Deposit-failed");
    }
  }

  /**
   * @dev Withdraw '_asset'.
   * @param _asset: token address to withdraw. (For Native: 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
   * @param _amount: token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
    // Get cToken address from mapping
    address cTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Create a reference to the corresponding cToken contract
    IGenCToken cToken = IGenCToken(cTokenAddr);

    if (_isNative(_asset)) {
      // use a proxy receiver because Hundred uses "to.transfer(amount)"
      // which runs out of gas whit proxy contracts
      uint256 exRate = cToken.exchangeRateStored();
      uint256 scaledAmount = _amount * 1e18 / exRate;

      address receiverAddr = _getProxyReceiver();
      cToken.transfer(receiverAddr, scaledAmount);
      IProxyReceiver(receiverAddr).withdraw(_amount, cToken);
    } else {
      require(cToken.redeemUnderlying(_amount) == 0, "Withdraw-failed");
    }
  }

  /**
   * @dev Borrow '_asset'.
   * @param _asset token address to borrow.(For Native: 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
   * @param _amount: token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    // Get cToken address from mapping
    address cTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Create a reference to the corresponding cToken contract
    IGenCToken cToken = IGenCToken(cTokenAddr);

    // Compound Protocol Borrow Process, throw errow if not.
    require(cToken.borrow(_amount) == 0, "borrow-failed");
  }

  /**
   * @dev Payback borrowed '_asset'.
   * @param _asset token address to payback.(For Native: 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)
   * @param _amount: token amount to payback.
   */
  function payback(address _asset, uint256 _amount) external payable override {
    // Get cToken address from mapping
    address cTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    if (_isNative(_asset)) {
      // Create a reference to the corresponding cToken contract
      ICEth cToken = ICEth(cTokenAddr);

      cToken.repayBorrow{ value: msg.value }();
    } else {
      // Create reference to the ERC20 contract
      IERC20 erc20token = IERC20(_asset);

      // Create a reference to the corresponding cToken contract
      ICErc20 cToken = ICErc20(cTokenAddr);

      // Check there is enough balance to pay
      require(erc20token.balanceOf(address(this)) >= _amount, "Not-enough-token");
      erc20token.univApprove(address(cTokenAddr), _amount);
      cToken.repayBorrow(_amount);
    }
  }

  /**
   * @dev Returns the current borrowing rate (APR) of '_asset', in ray(1e27).
   * @param _asset: token address to query the current borrowing rate.
   */
  function getBorrowRateFor(address _asset) external view override returns (uint256) {
    address cTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Block Rate transformed for common mantissa for Fuji in ray (1e27)
    // Note: Cream uses base 1e18
    uint256 bRateperBlock = IGenCToken(cTokenAddr).borrowRatePerBlock() * 10**9;

    // The approximate number of blocks per year that is assumed by the Cream interest rate model
    // ~60 blocks per min in fantom
    return bRateperBlock * 60 * 60 * 24 * 365;
  }

  /**
   * @dev Returns the borrow balance of '_asset' of caller.
   * NOTE: Returned value is at the last update state of provider.
   * @param _asset: token address to query the balance.
   */
  function getBorrowBalance(address _asset) external view override returns (uint256) {
    address cTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    return IGenCToken(cTokenAddr).borrowBalanceStored(msg.sender);
  }

  /**
   * @dev Return borrow balance of '_asset' of caller.
   * This function updates the state of provider contract to return latest borrow balance.
   * It costs ~84K gas and is not a view function.
   * @param _asset token address to query the balance.
   * @param _who address of the account.
   */
  function getBorrowBalanceOf(address _asset, address _who) external override returns (uint256) {
    address cTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    return IGenCToken(cTokenAddr).borrowBalanceCurrent(_who);
  }

  /**
   * @dev Returns the deposit balance of '_asset' of caller.
   * @param _asset: token address to query the balance.
   */
  function getDepositBalance(address _asset) external view override returns (uint256) {
    address cTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);
    uint256 cTokenBal = IGenCToken(cTokenAddr).balanceOf(msg.sender);
    uint256 exRate = IGenCToken(cTokenAddr).exchangeRateStored();

    return (exRate * cTokenBal) / 1e18;
  }
}
