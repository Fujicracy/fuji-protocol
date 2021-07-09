// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.7.5;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { LibUniversalERC20 } from "../Libraries/LibUniversalERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IProvider } from "./IProvider.sol";

interface IGenCyToken is IERC20 {
  function redeem(uint256) external returns (uint256);

  function redeemUnderlying(uint256) external returns (uint256);

  function borrow(uint256 borrowAmount) external returns (uint256);

  function exchangeRateCurrent() external returns (uint256);

  function exchangeRateStored() external view returns (uint256);

  function borrowRatePerBlock() external view returns (uint256);

  function balanceOfUnderlying(address owner) external returns (uint256);

  function getAccountSnapshot(address account)
    external
    view
    returns (
      uint256,
      uint256,
      uint256,
      uint256
    );

  function totalBorrowsCurrent() external returns (uint256);

  function borrowBalanceCurrent(address account) external returns (uint256);

  function borrowBalanceStored(address account) external view returns (uint256);

  function getCash() external view returns (uint256);
}

interface IWeth is IERC20 {
  function deposit() external payable;

  function withdraw(uint256 wad) external;
}

interface ICyErc20 is IGenCyToken {
  function mint(uint256) external returns (uint256);

  function repayBorrow(uint256 repayAmount) external returns (uint256);

  function repayBorrowBehalf(address borrower, uint256 repayAmount) external returns (uint256);
}

interface IComptroller {
  function markets(address) external returns (bool, uint256);

  function enterMarkets(address[] calldata) external returns (uint256[] memory);

  function exitMarket(address cyTokenAddress) external returns (uint256);

  function getAccountLiquidity(address)
    external
    view
    returns (
      uint256,
      uint256,
      uint256
    );
}

interface IFujiMappings {
  function addressMapping(address) external view returns (address);
}

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
  using SafeMath for uint256;
  using LibUniversalERC20 for IERC20;

  //Provider Core Functions

  /**
   * @dev Deposit ETH/ERC20_Token.
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
      IWeth(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).deposit{ value: _amount }();
      _asset = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    }

    // Create reference to the ERC20 contract
    IERC20 erc20token = IERC20(_asset);

    // Create a reference to the cyToken contract
    ICyErc20 cyToken = ICyErc20(cyTokenAddr);

    //Checks, Vault balance of ERC20 to make deposit
    require(erc20token.balanceOf(address(this)) >= _amount, "Not enough Balance");

    //Approve to move ERC20tokens
    erc20token.univApprove(address(cyTokenAddr), _amount);

    // IronBank Protocol mints cyTokens, trhow error if not
    require(cyToken.mint(_amount) == 0, "Deposit-failed");
  }

  /**
   * @dev Withdraw ETH/ERC20_Token.
   * @param _asset: token address to withdraw. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount: token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Create a reference to the corresponding cyToken contract
    IGenCyToken cyToken = IGenCyToken(cyTokenAddr);

    //IronBank Protocol Redeem Process, throw errow if not.
    require(cyToken.redeemUnderlying(_amount) == 0, "Withdraw-failed");

    if (_isETH(_asset)) {
      // Transform ETH to WETH
      IWeth(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).withdraw(_amount);
    }
  }

  /**
   * @dev Borrow ETH/ERC20_Token.
   * @param _asset token address to borrow.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount: token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    // Create a reference to the corresponding cyToken contract
    IGenCyToken cyToken = IGenCyToken(cyTokenAddr);

    //Enter and/or ensure collateral market is enacted
    //_enterCollatMarket(cyTokenAddr);

    //IronBank Protocol Borrow Process, throw errow if not.
    require(cyToken.borrow(_amount) == 0, "borrow-failed");
  }

  /**
   * @dev Payback borrowed ETH/ERC20_Token.
   * @param _asset token address to payback.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount: token amount to payback.
   */
  function payback(address _asset, uint256 _amount) external payable override {
    //Get cyToken address from mapping
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    if (_isETH(_asset)) {
      // Transform ETH to WETH
      IWeth(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).deposit{ value: _amount }();
      _asset = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    }

    // Create reference to the ERC20 contract
    IERC20 erc20token = IERC20(_asset);

    // Create a reference to the corresponding cyToken contract
    ICyErc20 cyToken = ICyErc20(cyTokenAddr);

    // Check there is enough balance to pay
    require(erc20token.balanceOf(address(this)) >= _amount, "Not-enough-token");
    erc20token.univApprove(address(cyTokenAddr), _amount);
    cyToken.repayBorrow(_amount);
  }

  /**
   * @dev Returns the current borrowing rate (APR) of a ETH/ERC20_Token, in ray(1e27).
   * @param _asset: token address to query the current borrowing rate.
   */
  function getBorrowRateFor(address _asset) external view override returns (uint256) {
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    //Block Rate transformed for common mantissa for Fuji in ray (1e27), Note: IronBank uses base 1e18
    uint256 bRateperBlock = (IGenCyToken(cyTokenAddr).borrowRatePerBlock()).mul(10**9);

    // The approximate number of blocks per year that is assumed by the IronBank interest rate model
    uint256 blocksperYear = 2102400;
    return bRateperBlock.mul(blocksperYear);
  }

  /**
   * @dev Returns the borrow balance of a ETH/ERC20_Token.
   * @param _asset: token address to query the balance.
   */
  function getBorrowBalance(address _asset) external view override returns (uint256) {
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    return IGenCyToken(cyTokenAddr).borrowBalanceStored(msg.sender);
  }

  /**
   * @dev Return borrow balance of ETH/ERC20_Token.
   * This function is the accurate way to get IronBank borrow balance.
   * It costs ~84K gas and is not a view function.
   * @param _asset token address to query the balance.
   * @param _who address of the account.
   */
  function getBorrowBalanceOf(address _asset, address _who) external override returns (uint256) {
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);

    return IGenCyToken(cyTokenAddr).borrowBalanceCurrent(_who);
  }

  /**
   * @dev Returns the deposit balance of a ETH/ERC20_Token.
   * @param _asset: token address to query the balance.
   */
  function getDepositBalance(address _asset) external view override returns (uint256) {
    address cyTokenAddr = IFujiMappings(_getMappingAddr()).addressMapping(_asset);
    uint256 cyTokenBal = IGenCyToken(cyTokenAddr).balanceOf(msg.sender);
    uint256 exRate = IGenCyToken(cyTokenAddr).exchangeRateStored();

    return exRate.mul(cyTokenBal).div(1e18);
  }
}
