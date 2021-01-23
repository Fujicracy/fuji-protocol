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

contract ProviderCompound {

  using SafeMath for uint256;
  using UniERC20 for IERC20;

  //Events
  event LogDeposit(address indexed token, address cToken, uint256 tokenAmt);
  event LogWithdraw(address indexed token, address cToken, uint256 tokenAmt);
  event LogBorrow(address indexed token, address cToken, uint256 tokenAmt);
  event LogPayback(address indexed token, address cToken, uint256 tokenAmt);

  address payable private ADMIN;
  address payable public theVault;
  address public comptroller;
  address public priceFeeder;

  //CToken Address mapping to erc20
  mapping(address => address ) erc20TocToken;

  //Modifiers
  modifier OnlyAdmin() {
    require( msg.sender == ADMIN || msg.sender == address(this), 'Admin Function Only');
    _; //run function
  }

  //Contract Initializer
  constructor(address payable _admin, address _comptroller,address _pricefeed) public {
    ADMIN = _admin;
    comptroller = _comptroller;
    priceFeeder = _pricefeed;

    /*Compound Protocol mainnet cToken Mappings, this can be removed once testing fase is done*/
    erc20TocToken[address(0xc00e94Cb662C3520282E6f5717214004A7f26888)] = address(0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643); //cDAI
    erc20TocToken[address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)] = address(0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5); //cETH
    erc20TocToken[address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)] = address(0x39AA39c021dfbaE8faC545936693aC917d5E7563); //cUSDC
    erc20TocToken[address(0xdAC17F958D2ee523a2206206994597C13D831ec7)] = address(0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9); //cUSDT
    erc20TocToken[address(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599)] = address(0xC11b1268C1A384e55C48c2391d8d480264A3A7F4); //cWBTC
    erc20TocToken[address(0xc00e94Cb662C3520282E6f5717214004A7f26888)] = address(0x70e36f6BF80a52b3B46b3aF8e106CC0ed743E8e4); //cCOMP
    /*Compound Protocol Kovan cToken Mappings, this can be removed once testing fase is done*/
    erc20TocToken[address(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa)] = address(0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD); //cDAI
    erc20TocToken[address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)] = address(0x41B5844f4680a8C38fBb695b7F9CFd1F64474a72); //cETH
    erc20TocToken[address(0xb7a4F3E9097C08dA09517b5aB877F7a917224ede)] = address(0x4a92E71227D294F041BD82dd8f78591B75140d63); //cUSDC
    erc20TocToken[address(0x07de306FF27a2B630B1141956844eB1552B956B5)] = address(0x3f0A0EA2f86baE6362CF9799B523BA06647Da018); //cUSDT
    erc20TocToken[address(0xd3A691C852CDB01E281545A27064741F0B7f6825)] = address(0xa1fAA15655B0e7b6B6470ED3d096390e6aD93Abb); //cWBTC

    //Compound Mainnet COMPTROLLER = 0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B
    //Compound Mainnet Pricefeed = 0x922018674c12a7f0d394ebeef9b58f186cde13c1
    //Compound Kovan COMPTROLLER = 0x5eae89dc1c671724a672ff0630122ee834098657
    //Compound Kovan Pricefeed = 0xbBdE93962Ca9fe39537eeA7380550ca6845F8db7
  }

  //Administrative functions
  function _setERC20_cTokenMap(address payable _erc20Address, address payable _cTokenAddress ) public OnlyAdmin {
    erc20TocToken[_erc20Address] = _cTokenAddress;
  }
  function _setVaultContract(address payable _newVault) public OnlyAdmin {
    theVault = _newVault;
  }
  function _setCompotroller(address _comptrollerContract) public OnlyAdmin {
    comptroller = _comptrollerContract;
  }
  function _enterCollatMarket(address _cTokenAddress) public OnlyAdmin {
    Comptroller Cptrllr = Comptroller(comptroller); // Create a reference to the corresponding network Comptroller
    address[] memory cTokenMarkets = new address[](1);
    cTokenMarkets[0] = _cTokenAddress;
    Cptrllr.enterMarkets(cTokenMarkets);
  }

  function _exitCollatMarket(address  _cTokenAddress) public OnlyAdmin {
    Comptroller Cptrllr = Comptroller(comptroller); // Create a reference to the corresponding network Comptroller
    Cptrllr.exitMarket(_cTokenAddress);
  }

  //Core Functions
  function deposit(address _depositAsset, uint256 _Amount) external payable{
    require(ismapped(_depositAsset), "Missing mapping ERC20 to cToken");
    address ctokenaddress = erc20TocToken[_depositAsset]; //Get cToken address from mapping

    if(isETH(_depositAsset)) { /*Compound Deposit Procedure for ETH*/

      require(msg.value != 0, "Missing msg.value");
      require(_Amount == msg.value, "Verify msg.value amount vs _Amount indicated");

      CEth cToken = CEth(ctokenaddress); // Create a reference to the cToken contract

      cToken.mint{value:msg.value, gas:250000}(); //Compound protocol Mints cTokens, ETH method
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
    require(ismapped(_withdrawAsset), "Missing mapping ERC20 to cToken");
    address ctokenaddress = erc20TocToken[_withdrawAsset]; //Get cToken address from mapping

    gencToken cToken = gencToken(ctokenaddress); // Create a reference to the corresponding cToken contract

    require(cToken.redeemUnderlying(_Amount) == 0, "Withdraw-failed");//Compound Protocol Redeem Process, throw errow if not.

    emit LogWithdraw(_withdrawAsset, ctokenaddress, _Amount);

    }/*end of withdraw function*/

    function borrow(address _borrowAsset, uint256 _Amount) external  payable{
      require(ismapped(_borrowAsset), "Missing mapping ERC20 to cToken");
      address ctokenaddress = erc20TocToken[_borrowAsset]; //Get cToken address from mapping

      gencToken cToken = gencToken(ctokenaddress); // Create a reference to the corresponding cToken contract

      _enterCollatMarket(ctokenaddress); //Enter and/or ensure collateral market is enacted

      require(cToken.borrow(_Amount) == 0, "borrow-failed"); //Compound Protocol Borrow Process, throw errow if not.

      emit LogBorrow(_borrowAsset, ctokenaddress, _Amount);

    }/*end of borrow function*/

    function payback(address _paybackAsset, uint256 _Amount) external  payable {
      require(ismapped(_paybackAsset), "Missing mapping ERC20 to cToken");
        address ctokenaddress = erc20TocToken[_paybackAsset]; //Get cToken address from mapping

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

    //internal Functions
    function getCollateralFactor(address  _cTokenAddress) internal  returns(uint256, uint256) {
      Comptroller Cptrllr = Comptroller(comptroller); // Create a reference to the corresponding network Comptroller
      (bool isListed, uint factorMantissa) = Cptrllr.markets(_cTokenAddress); //Call comptroller for information
      uint256 base = 1000000000000000000; //Compound Protocol constant, for collateral factor num operations
      return (factorMantissa, base);
    }

    function isETH(address token) internal pure returns (bool) {
    return (token == address(0) || token == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
    }

    function ismapped(address _Asset) public view returns(bool) {
      if (erc20TocToken[_Asset] == address(0)){
        return false;
      } else {
        return true;
      }
    }

    receive() external payable {}

    /* THESE ARE TEST ONLY FUNCTIONS, TO AVOID FUND LOCK*/
      function manualETHwithdrawtoVault(uint amount) public payable OnlyAdmin returns(uint) {
        //check balance of msg.sender is sufficient.
        theVault.transfer(amount);
        return address(this).balance;
      }

      function manualtransferERC20(address _erc20Address, uint amountToken) public OnlyAdmin {
        IERC20 erc20Token = IERC20(_erc20Address);
        erc20Token.transfer(theVault, amountToken);
      }

      function getPrice(address _priceFeedAddress, address _ctoken_address ) public view returns(uint256){
         PriceFeed pFeed = PriceFeed(_priceFeedAddress); // Create a reference to the corresponding network PriceFeedContract
         return pFeed.getUnderlyingPrice(_ctoken_address);
      }
}
