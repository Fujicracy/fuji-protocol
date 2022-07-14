// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/IFujiMappings.sol";
import "../../interfaces/IProvider.sol";
import "../../interfaces/dforce/IGenIToken.sol";
import "../../interfaces/dforce/IIErc20.sol";
import "../../interfaces/dforce/IIEth.sol";
import "../../interfaces/dforce/IController.sol";
import "../../libraries/LibUniversalERC20.sol";

contract HelperFunct {
  function _isNative(address token) internal pure returns (bool) {
    return (token == address(0) || token == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
  }

  function _getMappingAddr() internal pure returns (address) {
    return 0x410f9179eD194b8b3583abfEbB5C3ef2aCD62A34; // Fuji dForce Arbitrum Mapping
  }

  function _getControllerAddress() internal pure returns (address) {
    return 0x8E7e9eA9023B81457Ae7E6D2a51b003D421E5408; // dForce Arbitrum
  }

  // dForce functions

  /**
   * @dev Approves vault's assets as collateral for dForce Protocol.
   * @param _iTokenAddress: asset type to be approved as collateral.
   */
  function _enterCollatMarket(address _iTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    IController controller = IController(_getControllerAddress());

    address[] memory iTokenMarkets = new address[](1);
    iTokenMarkets[0] = _iTokenAddress;
    controller.enterMarkets(iTokenMarkets);
  }

  /**
   * @dev Removes vault's assets as collateral for dForce Protocol.
   * @param _iTokenAddress: asset type to be removed as collateral.
   */
  function _exitCollatMarket(address _iTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    IController controller = IController(_getControllerAddress());

    address[] memory iTokenMarkets = new address[](1);
    iTokenMarkets[0] = _iTokenAddress;
    controller.exitMarkets(iTokenMarkets);
  }
}

contract ProviderDForceArbitrum is IProvider, HelperFunct {
  using LibUniversalERC20 for IERC20;

  // Provider Core Functions

  /**
   * @dev Deposit '_asset'.
   * @param _asset: token address to deposit.
   * @param _amount: token amount to deposit.
   */
  function deposit(address _asset, uint256 _amount) external payable override {
    // Get iToken address from mapping
    address iTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Enter and/or ensure collateral market is enacted
    _enterCollatMarket(iTokenAddr);

    if (_isNative(_asset)) {
      // Create a reference to the iToken contract
      IIEth iToken = IIEth(iTokenAddr);

      // dForce protocol Mints iTokens, ETH method
      iToken.mint{ value: _amount }(address(this));
    } else {
      // Create reference to the ERC20 contract
      IERC20 erc20token = IERC20(_asset);

      // Create a reference to the iToken contract
      IIErc20 iToken = IIErc20(iTokenAddr);

      // Checks, Vault balance of ERC20 to make deposit
      require(erc20token.balanceOf(address(this)) >= _amount, "Not enough Balance");

      // Approve to move ERC20tokens
      erc20token.univApprove(address(iTokenAddr), _amount);

      // dForce Protocol mints iTokens
      iToken.mint(address(this), _amount);
    }
  }

  /**
   * @dev Withdraw '_asset'.
   * @param _asset: token address to withdraw.
   * @param _amount: token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
    // Get iToken address from mapping
    address iTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Create a reference to the corresponding iToken contract
    IGenIToken iToken = IGenIToken(iTokenAddr);

    // dForce Protocol Redeem Process, throw errow if not.
    iToken.redeemUnderlying(address(this), _amount);
  }

  /**
   * @dev Borrow '_asset'.
   * @param _asset token address to borrow.
   * @param _amount: token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    // Get iToken address from mapping
    address iTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Create a reference to the corresponding iToken contract
    IGenIToken iToken = IGenIToken(iTokenAddr);

    // dForce Protocol Borrow Process, throw errow if not.
    iToken.borrow(_amount);
  }

  /**
   * @dev Payback borrowed '_asset'.
   * @param _asset token address to payback.
   * @param _amount: token amount to payback.
   */
  function payback(address _asset, uint256 _amount) external payable override {
    // Get iToken address from mapping
    address iTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    if (_isNative(_asset)) {
      // Create a reference to the corresponding iToken contract
      IIEth iToken = IIEth(iTokenAddr);

      iToken.repayBorrow{ value: msg.value }();
    } else {
      // Create reference to the ERC20 contract
      IERC20 erc20token = IERC20(_asset);

      // Create a reference to the corresponding iToken contract
      IIErc20 iToken = IIErc20(iTokenAddr);

      // Check there is enough balance to pay
      require(erc20token.balanceOf(address(this)) >= _amount, "Not-enough-token");
      erc20token.univApprove(address(iTokenAddr), _amount);
      iToken.repayBorrow(_amount);
    }
  }

  /**
   * @dev Returns the current borrowing rate (APR) of '_asset', in ray(1e27).
   * @param _asset: token address to query the current borrowing rate.
   */
  function getBorrowRateFor(address _asset) external view override returns (uint256) {
    address iTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Block Rate transformed for common mantissa for Fuji in ray (1e27), Note: dForce uses base 1e18
    uint256 bRateperBlock = IGenIToken(iTokenAddr).borrowRatePerBlock() * 10**9;

    // The approximate number of blocks per year that is assumed by the dForce interest rate model
    uint256 blocksperYear = 2102400;
    return bRateperBlock * blocksperYear;
  }

  /**
   * @dev Returns the current deposit rate (APR) of '_asset', in ray(1e27).
   * @param _asset: token address to query the current deposit rate.
   */
  function getDepositRateFor(address _asset) external view returns (uint256) {
    address iTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Block Rate transformed for common mantissa for Fuji in ray (1e27), Note: dForce uses base 1e18
    uint256 bRateperBlock = IGenIToken(iTokenAddr).supplyRatePerBlock() * 10**9;

    // The approximate number of blocks per year that is assumed by the dForce interest rate model
    uint256 blocksperYear = 2102400;
    return bRateperBlock * blocksperYear;
  }

  /**
   * @dev Returns the borrow balance of '_asset' of caller.
   * NOTE: Returned value is at the last update state of provider.
   * @param _asset: token address to query the balance.
   */
  function getBorrowBalance(address _asset) external view override returns (uint256) {
    address iTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    return IGenIToken(iTokenAddr).borrowBalanceStored(msg.sender);
  }

  /**
   * @dev Return borrow balance of '_asset' of caller.
   * This function updates the state of provider contract to return latest borrow balance.
   * It costs ~84K gas and is not a view function.
   * @param _asset token address to query the balance.
   * @param _who address of the account.
   */
  function getBorrowBalanceOf(address _asset, address _who) external override returns (uint256) {
    address iTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    return IGenIToken(iTokenAddr).borrowBalanceCurrent(_who);
  }

  /**
   * @dev Returns the deposit balance of '_asset' of caller.
   * @param _asset: token address to query the balance.
   */
  function getDepositBalance(address _asset) external view override returns (uint256) {
    address iTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);
    uint256 iTokenBal = IGenIToken(iTokenAddr).balanceOf(msg.sender);
    uint256 exRate = IGenIToken(iTokenAddr).exchangeRateStored();

    return (exRate * iTokenBal) / 1e18;
  }
}
