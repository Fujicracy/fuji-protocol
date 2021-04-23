// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.7.5;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { UniERC20 } from "../Libraries/LibUniERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IProvider } from "./IProvider.sol";

import "hardhat/console.sol"; //test line

interface gencToken is IERC20{
  function redeem(uint) external returns (uint);
  function redeemUnderlying(uint) external returns (uint);
  function borrow(uint borrowAmount) external returns (uint);
  function exchangeRateCurrent() external returns (uint256);
  function exchangeRateStored() external view returns (uint);
  function borrowRatePerBlock() external view returns (uint);
  function balanceOfUnderlying(address owner) external returns (uint);
  function getAccountSnapshot(address account) external view returns (uint, uint, uint, uint);
  function totalBorrowsCurrent() external returns (uint);
  function borrowBalanceCurrent(address account) external returns (uint);
  function borrowBalanceStored(address account) external view returns (uint);
  function getCash() external view returns (uint);
}

interface CErc20 is gencToken {
  function mint(uint256) external returns (uint256);
  function repayBorrow(uint repayAmount) external returns (uint);
  function repayBorrowBehalf(address borrower, uint repayAmount) external returns (uint);
  function _addReserves(uint addAmount) external returns (uint);
}

interface CEth is gencToken {
  function mint() external payable;
  function repayBorrow() external payable;
  function repayBorrowBehalf(address borrower) external payable;
}

interface Comptroller {
  function markets(address) external returns (bool, uint256);
  function enterMarkets(address[] calldata) external returns (uint256[] memory);
  function exitMarket(address cTokenAddress) external returns (uint);
  function getAccountLiquidity(address) external view returns (uint256, uint256, uint256);
}

interface FujiMappings {
  function cTokenMapping(address) external view returns (address);
}

contract HelperFunct {

  function isETH(address token) internal pure returns (bool) {
    return (token == address(0) || token == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
  }

  function getMappingAddr() internal pure returns (address) {
    // FujiMapping Address, to be replaced
    return 0xe81F70Cc7C0D46e12d70efc60607F16bbD617E88;
  }

  function getComptrollerAddress() internal pure returns (address) {
    return 0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B;
  }

  //Compound functions

  /**
  * @dev Approves vault's assets as collateral for Compound Protocol.
  * @param _cTokenAddress: asset type to be approved as collateral.
  */
  function _enterCollatMarket(address _cTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    Comptroller Cptrllr = Comptroller(getComptrollerAddress());

    address[] memory cTokenMarkets = new address[](1);
    cTokenMarkets[0] = _cTokenAddress;
    Cptrllr.enterMarkets(cTokenMarkets);
  }

  /**
  * @dev Removes vault's assets as collateral for Compound Protocol.
  * @param _cTokenAddress: asset type to be removed as collateral.
  */
  function _exitCollatMarket(address _cTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    Comptroller Cptrllr = Comptroller(getComptrollerAddress());

    Cptrllr.exitMarket(_cTokenAddress);
  }

}

contract ProviderCompound is IProvider, HelperFunct {

  using SafeMath for uint256;
  using UniERC20 for IERC20;

  //Provider Core Functions

  /**
 * @dev Deposit ETH/ERC20_Token.
 * @param _depositAsset: token address to deposit. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
 * @param _amount: token amount to deposit.
 */
  function deposit(address _depositAsset, uint256 _amount) external override payable {
    //Get cToken address from mapping
    address ctokenaddress = FujiMappings(getMappingAddr()).cTokenMapping(_depositAsset);

    //Enter and/or ensure collateral market is enacted
    _enterCollatMarket(ctokenaddress);

    if (isETH(_depositAsset)) {
      // Create a reference to the cToken contract
      CEth cToken = CEth(ctokenaddress);

      //Compound protocol Mints cTokens, ETH method
      cToken.mint{value: _amount}();
    }
    else {
      // Create reference to the ERC20 contract
      IERC20 ERC20token = IERC20(_depositAsset);

      // Create a reference to the cToken contract
      CErc20 cToken = CErc20(ctokenaddress);

      //Checks, Vault balance of ERC20 to make deposit
      require(ERC20token.balanceOf(address(this)) >= _amount, "Not enough Balance");

      //Approve to move ERC20tokens
      ERC20token.approve(ctokenaddress, _amount);

      // Compound Protocol mints cTokens, trhow error if not
      require(cToken.mint(_amount)==0, "deposit-failed");
    }
  }

  /**
 * @dev Withdraw ETH/ERC20_Token.
 * @param _withdrawAsset: token address to withdraw. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
 * @param _amount: token amount to withdraw.
 */
  function withdraw(address _withdrawAsset, uint256 _amount) external override payable {
    //Get cToken address from mapping
    address ctokenaddress = FujiMappings(getMappingAddr()).cTokenMapping(_withdrawAsset);

    // Create a reference to the corresponding cToken contract
    gencToken cToken = gencToken(ctokenaddress);

    //Compound Protocol Redeem Process, throw errow if not.
    require(cToken.redeemUnderlying(_amount) == 0, "Withdraw-failed");
  }

  /**
 * @dev Borrow ETH/ERC20_Token.
 * @param _borrowAsset token address to borrow.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
 * @param _amount: token amount to borrow.
 */
  function borrow(address _borrowAsset, uint256 _amount) external override payable {
    //Get cToken address from mapping
    address ctokenaddress = FujiMappings(getMappingAddr()).cTokenMapping(_borrowAsset);

    // Create a reference to the corresponding cToken contract
    gencToken cToken = gencToken(ctokenaddress);

    //Enter and/or ensure collateral market is enacted
    _enterCollatMarket(ctokenaddress);

    //Compound Protocol Borrow Process, throw errow if not.
    require(cToken.borrow(_amount) == 0, "borrow-failed");

  }

  /**
  * @dev Payback borrowed ETH/ERC20_Token.
  * @param _paybackAsset token address to payback.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
  * @param _amount: token amount to payback.
  */
  function payback(address _paybackAsset, uint256 _amount) external override payable {
    //Get cToken address from mapping
    address ctokenaddress = FujiMappings(getMappingAddr()).cTokenMapping(_paybackAsset);

    if (isETH(_paybackAsset)) {
      // Create a reference to the corresponding cToken contract
      CEth cToken = CEth(ctokenaddress);

      cToken.repayBorrow{value: msg.value}();
    }
    else {
      // Create reference to the ERC20 contract
      IERC20 ERC20token = IERC20(_paybackAsset);

      // Create a reference to the corresponding cToken contract
      CErc20 cToken = CErc20(ctokenaddress);

      // Check there is enough balance to pay
      require(ERC20token.balanceOf(address(this)) >= _amount, "not-enough-token");
      ERC20token.approve(ctokenaddress, _amount);
      cToken.repayBorrow(_amount);
    }
  }

  /**
  * @dev Returns the current borrowing rate (APR) of a ETH/ERC20_Token, in ray(1e27).
  * @param _asset: token address to query the current borrowing rate.
  */
  function getBorrowRateFor(address _asset) external view override returns(uint256) {
    address ctokenaddress = FujiMappings(getMappingAddr()).cTokenMapping(_asset);

    //Block Rate transformed for common mantissa for Fuji in ray (1e27), Note: Compound uses base 1e18
    uint256 bRateperBlock = (gencToken(ctokenaddress).borrowRatePerBlock()).mul(10**9);

    // The approximate number of blocks per year that is assumed by the Compound interest rate model
    uint256 blocksperYear = 2102400;
    return bRateperBlock.mul(blocksperYear);
  }

  /**
  * @dev Returns the borrow balance of a ETH/ERC20_Token.
  * @param _asset: token address to query the balance.
  */
  function getBorrowBalance(address _asset) external view override returns(uint256) {
    address ctokenaddress = FujiMappings(getMappingAddr()).cTokenMapping(_asset);
    return gencToken(ctokenaddress).borrowBalanceStored(msg.sender);
  }

  /**
  * @dev Returns the deposit balance of a ETH/ERC20_Token.
  * @param _asset: token address to query the balance.
  */
  function getDepositBalance(address _asset) external view override returns(uint256) {
    address ctokenaddress = FujiMappings(getMappingAddr()).cTokenMapping(_asset);
    uint256 cTokenbal = gencToken(ctokenaddress).balanceOf(msg.sender);
    uint256 exRate = gencToken(ctokenaddress).exchangeRateStored();
    uint256 depositBal = (exRate.mul(cTokenbal).div(1e18));
    return depositBal;
  }

  //This function is the accurate way to get Compound Deposit Balance but it costs 84K gas
  function getDepositBalanceTest(address _asset, address addr) external returns(uint256) {
    address ctokenaddress = FujiMappings(getMappingAddr()).cTokenMapping(_asset);
    uint256 depositBal = gencToken(ctokenaddress).balanceOfUnderlying(addr);
    return depositBal;
  }

}
