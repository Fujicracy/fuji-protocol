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
  return 0xe81F70Cc7C0D46e12d70efc60607F16bbD617E88; // InstaMapping Address, to be replaced
  }

  function getComptrollerAddress() internal pure returns (address) {
      return 0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B;
  }
}


contract ProviderCompound is HelperFunct {

  using SafeMath for uint256;
  using UniERC20 for IERC20;

  //Events
  event LogDeposit(address indexed token, address cToken, uint256 tokenAmt);
  event LogWithdraw(address indexed token, address cToken, uint256 tokenAmt);
  event LogBorrow(address indexed token, address cToken, uint256 tokenAmt);
  event LogPayback(address indexed token, address cToken, uint256 tokenAmt);

  //Administrative functions

  function _enterCollatMarket(address _cTokenAddress) internal {
    Comptroller Cptrllr = Comptroller(getComptrollerAddress()); // Create a reference to the corresponding network Comptroller
    address[] memory cTokenMarkets = new address[](1);
    cTokenMarkets[0] = _cTokenAddress;
    Cptrllr.enterMarkets(cTokenMarkets);
  }

  function _exitCollatMarket(address  _cTokenAddress) internal {
    Comptroller Cptrllr = Comptroller(getComptrollerAddress()); // Create a reference to the corresponding network Comptroller
    Cptrllr.exitMarket(_cTokenAddress);
  }

  //Core Functions
  function deposit(address _depositAsset, uint256 _Amount) external payable{
    address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_depositAsset); //Get cToken address from mapping

    if(isETH(_depositAsset)) { /*Compound Deposit Procedure for ETH*/

      require(msg.value != 0, "Missing msg.value");
      require(_Amount == msg.value, "Verify msg.value amount vs _Amount indicated");
      CEth cToken = CEth(ctokenaddress); // Create a reference to the cToken contract
      cToken.mint{value:msg.value}(); //Compound protocol Mints cTokens, ETH method

      emit LogDeposit(_depositAsset, ctokenaddress, _Amount);

    } else { /*Compound Desposit Procedure for a ERC20 Token*/

      IERC20 ERC20token = IERC20(_depositAsset); // Create reference to the ERC20 contract
      CErc20 cToken = CErc20(ctokenaddress); // Create a reference to the cToken contract
      require(ERC20token.balanceOf(address(this)) >= _Amount, "Not enough Balance"); //Checks, Vault balance of ERC20 to make deposit
      ERC20token.approve(ctokenaddress, _Amount); //Approve to move ERC20tokens
      require(cToken.mint(_Amount)==0, "deposit-failed");  // Compound Protocol mints cTokens, trhow error if not

      emit LogDeposit(_depositAsset, ctokenaddress, _Amount);

    }
  }/*end of deposit function*/

  function withdraw (address _withdrawAsset, uint256 _Amount) external  payable{
    address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_withdrawAsset); //Get cToken address from mapping
    gencToken cToken = gencToken(ctokenaddress); // Create a reference to the corresponding cToken contract
    require(cToken.redeemUnderlying(_Amount) == 0, "Withdraw-failed");//Compound Protocol Redeem Process, throw errow if not.

    emit LogWithdraw(_withdrawAsset, ctokenaddress, _Amount);

    }/*end of withdraw function*/

    function borrow(address _borrowAsset, uint256 _Amount) external  payable{
      address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_borrowAsset); //Get cToken address from mapping
      gencToken cToken = gencToken(ctokenaddress); // Create a reference to the corresponding cToken contract
      _enterCollatMarket(ctokenaddress); //Enter and/or ensure collateral market is enacted
      require(cToken.borrow(_Amount) == 0, "borrow-failed"); //Compound Protocol Borrow Process, throw errow if not.

      emit LogBorrow(_borrowAsset, ctokenaddress, _Amount);

    }/*end of borrow function*/

    function payback(address _paybackAsset, uint256 _Amount) external  payable {
      address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_paybackAsset); //Get cToken address from mapping

      if(isETH(_paybackAsset)) { /*Compound payback Procedure for ETH*/
        require(msg.value != 0, "Missing msg.value");
        require(_Amount == msg.value, "Verify msg.value amount vs _borrowAmount indicated");
        CEth cToken = CEth(ctokenaddress); // Create a reference to the corresponding cToken contract
        cToken.repayBorrow{value:msg.value}();

        emit LogPayback(_paybackAsset, ctokenaddress, _Amount);

      } else { /*Compound payback Procedure for a ERC20 Token*/

        IERC20 ERC20token = IERC20(_paybackAsset); // Create reference to the ERC20 contract
        CErc20 cToken = CErc20(ctokenaddress); // Create a reference to the corresponding cToken contract
        require(ERC20token.balanceOf(address(this)) >= _Amount, "not-enough-token"); // Check there is enough balance to pay
        ERC20token.approve(ctokenaddress, _Amount);
        cToken.repayBorrow(_Amount);

        emit LogPayback(_paybackAsset, ctokenaddress, _Amount);

      }
    } /*end of payback function*/

    function getRedeemableAddress(address collateralAsset) external returns(address) {
      return InstaMapping(getMappingAddr()).cTokenMapping(collateralAsset);
    }

    function getBorrowRateFor(address _asset) external returns(uint256) {
      gencToken cToken = gencToken(_asset);
      address ctokenaddress = InstaMapping(getMappingAddr()).cTokenMapping(_asset);
      return cToken.borrowRatePerBlock(ctokenaddress);
    }

    receive() external payable {}
}
