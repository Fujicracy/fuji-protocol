// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.7.5;

import "./LibUniERC20.sol";
import "./IProvider.sol";

interface gencToken{
  function redeem(uint) external returns (uint);
  function redeemUnderlying(uint) external returns (uint);
  function borrow(uint borrowAmount) external returns (uint);
  function exchangeRateCurrent() external returns (uint256);
  function supplyRatePerBlock() external returns (uint256);
  function borrowRatePerBlock() external view returns (uint);
  function balanceOfUnderlying(address owner) external returns (uint);
  function getAccountSnapshot(address account) external view returns (uint, uint, uint, uint);
  function totalBorrowsCurrent() external returns (uint);
  function borrowBalanceCurrent(address account) external returns (uint);
  function borrowBalanceStored(address account) external view returns (uint);
  function exchangeRateStored() external view returns (uint);
  function getCash() external view returns (uint);
  function accrueInterest() external returns (uint);
  function seize(address liquidator, address borrower, uint seizeTokens) external returns (uint);
}

interface CErc20 is IERC20, gencToken {
  function mint(uint256) external returns (uint256);
  function repayBorrow(uint repayAmount) external returns (uint);
  function repayBorrowBehalf(address borrower, uint repayAmount) external returns (uint);
  function _addReserves(uint addAmount) external returns (uint);
}

interface CEth is IERC20, gencToken {
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

interface PriceFeed {
  function getUnderlyingPrice(address cToken) external view returns (uint);
}

interface InstaMapping {
  function cTokenMapping(address) external view returns (address);
}

contract HelperFunct {

  function isETH(address token) internal pure returns (bool) {
    return (token == address(0) || token == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
  }

  function getMappingAddr() internal pure returns (address) {
    // InstaMapping Address, to be replaced
    return 0xe81F70Cc7C0D46e12d70efc60607F16bbD617E88;
  }

  function getComptrollerAddress() internal pure returns (address) {
    return 0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B;
  }
}

contract ProviderCompound is IProvider, HelperFunct {

  using SafeMath for uint256;
  using UniERC20 for IERC20;

  //Administrative functions

  function _enterCollatMarket(address _cTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    Comptroller Cptrllr = Comptroller(getComptrollerAddress());

    address[] memory cTokenMarkets = new address[](1);
    cTokenMarkets[0] = _cTokenAddress;
    Cptrllr.enterMarkets(cTokenMarkets);
  }

  function _exitCollatMarket(address _cTokenAddress) internal {
    // Create a reference to the corresponding network Comptroller
    Comptroller Cptrllr = Comptroller(getComptrollerAddress());

    Cptrllr.exitMarket(_cTokenAddress);
  }

  //Core Functions

  function deposit(address _depositAsset, uint256 _amount) external override payable {
    //Get cToken address from mapping
    address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_depositAsset);

    //Enter and/or ensure collateral market is enacted
    _enterCollatMarket(ctokenaddress);

    if (isETH(_depositAsset)) {
      // Create a reference to the cToken contract
      CEth cToken = CEth(ctokenaddress);

      //Compound protocol Mints cTokens, ETH method
      cToken.mint{value: msg.value}();
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

  function withdraw(address _withdrawAsset, uint256 _amount) external override payable {
    //Get cToken address from mapping
    address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_withdrawAsset);

    // Create a reference to the corresponding cToken contract
    gencToken cToken = gencToken(ctokenaddress);

    //Compound Protocol Redeem Process, throw errow if not.
    require(cToken.redeemUnderlying(_amount) == 0, "Withdraw-failed");
  }

  function borrow(address _borrowAsset, uint256 _amount) external override payable {
    //Get cToken address from mapping
    address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_borrowAsset);

    // Create a reference to the corresponding cToken contract
    gencToken cToken = gencToken(ctokenaddress);

    //Enter and/or ensure collateral market is enacted
    _enterCollatMarket(ctokenaddress);

    //Compound Protocol Borrow Process, throw errow if not.
    require(cToken.borrow(_amount) == 0, "borrow-failed");

  }

  function payback(address _paybackAsset, uint256 _amount) external override payable {
    //Get cToken address from mapping
    address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_paybackAsset);

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

  function getRedeemableAddress(address collateralAsset) external view override returns(address) {
    return InstaMapping(getMappingAddr()).cTokenMapping(collateralAsset);
  }

  function getBorrowRateFor(address _asset) external view override returns(uint256) {
    address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_asset);
    return gencToken(ctokenaddress).borrowRatePerBlock();
  }

  function getBorrowBalance(address _asset) external override returns(uint256) {
    address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_asset);
    return gencToken(ctokenaddress).borrowBalanceCurrent(msg.sender);
  }
}
