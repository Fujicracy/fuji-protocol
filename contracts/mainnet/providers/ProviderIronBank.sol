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
import "../libraries/LibUniversalERC20.sol";

contract HelperFunct {
  function _isETH(address token) internal pure returns (bool) {
    return (token == address(0) || token == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
  }

  function _getMappingAddr() internal pure returns (address) {
    return 0x17525aFdb24D24ABfF18108E7319b93012f3AD24;
  }

  function _getComptrollerAddress() internal pure returns (address) {
    return 0xAB1c342C7bf5Ec5F02ADEA1c2270670bCa144CbB;
  }

  function _getUnwrapper() internal pure returns (address) {
    return 0x9e2B7c84EbC915F848bA69ba44Cf75044cF10951;
  }

  //IronBank functions

  /**
   * @dev Approves vault's assets as collateral for IronBank Protocol.
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
   * @dev Removes vault's assets as collateral for IronBank Protocol.
   * @param _cyTokenAddress: asset type to be removed as collateral.
   */
  function _exitCollatMarket(address _cyTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    IComptroller comptroller = IComptroller(_getComptrollerAddress());

    comptroller.exitMarket(_cyTokenAddress);
  }
}

contract ProviderIronBank is IProvider, HelperFunct {
  using LibUniversalERC20 for IERC20;

  //Provider Core Functions

  /**
   * @dev Deposit '_asset'.
   * @param _asset: token address to deposit. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount: token amount to deposit.
   */
  function deposit(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    //Enter and/or ensure collateral market is enacted
    _enterCollatMarket(cyTokenAddr);

    if (_isETH(_asset)) {
      // Transform ETH to WETH
      IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).deposit{ value: _amount }();
      _asset = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    }

    // Create reference to the ERC20 contract
    IERC20 erc20token = IERC20(_asset);

    // Create a reference to the cyToken contract
    ICErc20 cyToken = ICErc20(cyTokenAddr);

    //Checks, Vault balance of ERC20 to make deposit
    require(erc20token.balanceOf(address(this)) >= _amount, "Not enough Balance");

    //Approve to move ERC20tokens
    erc20token.univApprove(address(cyTokenAddr), _amount);

    // IronBank Protocol mints cyTokens, trhow error if not
    require(cyToken.mint(_amount) == 0, "Deposit-failed");
  }

  /**
   * @dev Withdraw '_asset'.
   * @param _asset: token address to withdraw. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount: token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Create a reference to the corresponding cyToken contract
    IGenCToken cyToken = IGenCToken(cyTokenAddr);

    //IronBank Protocol Redeem Process, throw errow if not.
    require(cyToken.redeemUnderlying(_amount) == 0, "Withdraw-failed");

    if (_isETH(_asset)) {
      // Transform WETH to ETH
      address unwrapper = _getUnwrapper();
      IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Borrow '_asset'.
   * @param _asset token address to borrow.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount: token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Create a reference to the corresponding cyToken contract
    IGenCToken cyToken = IGenCToken(cyTokenAddr);

    //IronBank Protocol Borrow Process, throw errow if not.
    require(cyToken.borrow(_amount) == 0, "borrow-failed");

    if (_isETH(_asset)) {
      // Transform WETH to ETH
      address unwrapper = _getUnwrapper();
      IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Payback borrowed '_asset'.
   * @param _asset token address to payback.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount: token amount to payback.
   */
  function payback(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    if (_isETH(_asset)) {
      // Transform ETH to WETH
      IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).deposit{ value: _amount }();
      _asset = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
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

    //Block Rate transformed for common mantissa for Fuji in ray (1e27), Note: IronBank uses base 1e18
    uint256 bRateperBlock = IGenCToken(cyTokenAddr).borrowRatePerBlock() * 10**9;

    // The approximate number of blocks per year that is assumed by the IronBank interest rate model
    uint256 blocksperYear = 2102400;
    return bRateperBlock * blocksperYear;
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
