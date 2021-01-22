// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.5;

import "./LibUniERC20.sol";
import "./IProvider.sol";

/*interface IERC20 {
    function allowance(address owner, address spender) external view returns (uint);
    function approve(address, uint256) external returns (bool);
    function balanceOf(address owner) external view returns (uint);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address src, address dst, uint256 amount) external returns (bool);
}*/

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

  address payable private ADMIN;
  address payable public theVault;
  address public comptroller;

  struct SFactor {  //Safety factor for collateral
    uint256 a;  //  a divided by b represent Safetyfactor, example 1.2, or +20%, is (a/b)= 6/5
    uint256 b;
  }

  SFactor public safetyFactor;

  //CToken Address mapping to erc20
  mapping(address => address ) erc20TocToken;

  //Open Debt Positions
  mapping(address => uint256 ) OpPositions;

  //Modifiers
  modifier OnlyAdmin() {
    require( msg.sender == ADMIN || msg.sender == address(this), 'Admin Function Only');
    _; //run function
  }

  //Contract Initializer

  constructor() internal {
    ADMIN = 0x3BFf7fD5AACb1a22e1dd3ddbd8cfB8622A9E9A5B;

    /*Compound Protocol mainnet cToken Mappings*/
    /*this can be removed once testing fase is done*/
    erc20TocToken[address(0xc00e94Cb662C3520282E6f5717214004A7f26888)] = address(0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643); //cDAI
    erc20TocToken[address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)] = address(0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5); //cETH
    erc20TocToken[address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)] = address(0x39AA39c021dfbaE8faC545936693aC917d5E7563); //cUSDC
    erc20TocToken[address(0xdAC17F958D2ee523a2206206994597C13D831ec7)] = address(0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9); //cUSDT
    erc20TocToken[address(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599)] = address(0xC11b1268C1A384e55C48c2391d8d480264A3A7F4); //cWBTC
    erc20TocToken[address(0xc00e94Cb662C3520282E6f5717214004A7f26888)] = address(0x70e36f6BF80a52b3B46b3aF8e106CC0ed743E8e4); //cCOMP

    //Compund Mainnet COMPTROLLER
    comptroller = 0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B;

    //Colateral safety factor
    safetyFactor.a = 6;
    safetyFactor.b =5;
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
  function _setCollateralSafetyFactor(uint256 _a, uint256 _b) public OnlyAdmin {
    safetyFactor.a = _a;
    safetyFactor.b = _b;
  }

  function _enterCollatMarket(address _cTokenAddress) public OnlyAdmin {
    Comptroller Cptrllr = Comptroller(comptroller); // Create a reference to the corresponding network Comptroller
    address[] memory cTokenMarkets;
    cTokenMarkets[0] = _cTokenAddress;
    Cptrllr.enterMarkets(cTokenMarkets);
  }

  function _exitCollatMarket(address  _cTokenAddress) public OnlyAdmin {
    Comptroller Cptrllr = Comptroller(comptroller); // Create a reference to the corresponding network Comptroller
    Cptrllr.exitMarket(_cTokenAddress);
  }

  //Core Functions

  function deposit(address _collateralAsset, uint256 _collateralAmount) external virtual payable{
    require(ismapped(_collateralAsset), "Missing mapping ERC20 to cToken");

    if(isETH(_collateralAsset)) { /*Compound Deposit Procedure for ETH*/
      require(msg.value != 0, "Missing msg.value");
      require(_collateralAmount == msg.value, "Verify msg.value amount vs _collateralAmount indicated");

      CEth cToken = CEth(erc20TocToken[_collateralAsset]); // Create a reference to the cToken contract
      cToken.mint{value:msg.value, gas:250000}(); //Compound protocol Mints cTokens, ETH method
      uint numcTokens = cToken.balanceOf(address(this)); //Transfer cTokens to Vault
      cToken.transfer(msg.sender, numcTokens);

    } else { /*Compound Desposit Procedure for a ERC20 Token*/

      IERC20 ERC20token = IERC20(_collateralAsset); // Create reference to the ERC20 contract
      CErc20 cToken = CErc20(erc20TocToken[_collateralAsset]); // Create a reference to the cToken contract

      //Checks, Vault balance, and allowance to Provider Contract
      require(ERC20token.balanceOf(msg.sender) >= _collateralAmount, "Not enough Balance");
      require(ERC20token.allowance(msg.sender, address(this)) >= _collateralAmount, "Provide ERC20 Approve" );

      ERC20token.transferFrom(msg.sender, address(this), _collateralAmount); //Transfer to Provider Contract
      ERC20token.approve(erc20TocToken[_collateralAsset], _collateralAmount); //Approve to move ERC20tokens

      uint256 numcTokens = cToken.mint(_collateralAmount);  // Compound Protocol mints cTokens
      cToken.transfer(msg.sender, numcTokens); //Transfer cTokens to Vault
    }
  }/*end of deposit function*/

  function withdraw (address _collateralAsset, uint256 _collateralAmount) external virtual payable{
    require(ismapped(_collateralAsset), "Missing mapping ERC20 to cToken");

    if(isETH(_collateralAsset)) { /*Compound Procedure to Withdraw ETH given ETH amount*/
        CEth cToken = CEth(erc20TocToken[_collateralAsset]); // Create a reference to the corresponding cToken contract

          uint256 exchangeRate = cToken.exchangeRateCurrent(); //Get exchange rate ctoken, and Calculate amount of cToken needed
          uint256 cToken_amountneeded = _collateralAmount * exchangeRate;

          //Checks allowance to Provider Contract
          require(cToken.allowance(msg.sender, address(this)) >= cToken_amountneeded, "Provide ERC20 Approve" );

          cToken.transferFrom(msg.sender, address(this), cToken_amountneeded); //Send cTokens from Vault to ProviderContract
          cToken.approve(erc20TocToken[_collateralAsset], cToken_amountneeded); // Approve moving cTokens from ProviderContract to ctoken Address
          cToken.redeem(cToken_amountneeded); //Compound Protocol Redeem Process.
          msg.sender.transfer(_collateralAmount); //Send all Eth funds to theVault, this function assumes Provider contract does not have lingering ETH


        } else { /* Compound Procedure to withdraw ERC20 Token given ERC20 token amount*/

          IERC20 ERC20token = IERC20(_collateralAsset); // Create reference to the ERC20 contract
          CErc20 cToken = CErc20(erc20TocToken[_collateralAsset]); // Create a reference to the corresponding cToken contract

          uint256 exchangeRate = cToken.exchangeRateCurrent(); //Get exchange rate ctoken, and Calculate amount of cToken needed
          uint256 cToken_amountneeded = _collateralAmount * exchangeRate;

          //Checks allowance to Provider Contract
          require(cToken.allowance(msg.sender, address(this)) >= cToken_amountneeded, "Provide ERC20 Approve" );

          cToken.transferFrom(msg.sender, address(this), cToken_amountneeded); //Send cTokens to ProviderContract
          cToken.approve(erc20TocToken[_collateralAsset], cToken_amountneeded); // Approve moving cTokens from ProviderContract to ctoken Address
          cToken.redeem(cToken_amountneeded); //Compound Protocol Redeem Process.
          ERC20token.transfer(msg.sender, _collateralAmount); //Transfer erc20 tokens to Vault
        }
    }/*end of withdraw function*/

    function borrow(address _borrowAsset, uint256 _borrowAmount) external virtual payable{
      require(ismapped(_borrowAsset), "Missing mapping ERC20 to cToken");
      if(isETH(_borrowAsset)) {
        CEth cToken = CEth(erc20TocToken[_borrowAsset]); // Create a reference to the corresponding cToken contract

        uint256 exchangeRate = cToken.exchangeRateCurrent(); //Get exchange rate ctoken per underlying
        (uint256 factorMantissa, uint256 base) = getCollateralFactor(erc20TocToken[_borrowAsset]);
        //Calculate how many ctokens needed, + %Safety Factor to avoid liquidation
        uint256 cToken_amountneeded = includeSafetyFactorCollateral(((_borrowAmount.mul(exchangeRate)).div(factorMantissa)).mul(base));

        _enterCollatMarket(erc20TocToken[_borrowAsset]);

        //checks before proceeding
        require(cToken.allowance(msg.sender, address(this)) >= cToken_amountneeded, "Provide ERC20 Approve" );
        cToken.transferFrom(msg.sender, address(this), cToken_amountneeded); //Send cTokens from Vault to ProviderContract
        cToken.borrow(_borrowAmount); //Compound Protocol
        msg.sender.transfer(_borrowAmount); //Transfer borrowed ETH to the Vault

      } else {
        IERC20 ERC20token = IERC20(_borrowAsset); // Create reference to the ERC20 contract
        CErc20 cToken = CErc20(erc20TocToken[_borrowAsset]); // Create a reference to the corresponding cToken contract

        uint256 exchangeRate = cToken.exchangeRateCurrent(); //Get exchange rate ctoken per underlying
        (uint256 factorMantissa, uint256 base) = getCollateralFactor(erc20TocToken[_borrowAsset]);
        //Calculate how many ctokens needed, + %Safety Factor to avoid liquidation
        uint256 cToken_amountneeded = includeSafetyFactorCollateral(((_borrowAmount.mul(exchangeRate)).div(factorMantissa)).mul(base));

        //checks before proceeding
        require(cToken.allowance(msg.sender, address(this)) >= cToken_amountneeded, "Provide ERC20 Approve" );
        cToken.transferFrom(msg.sender, address(this), cToken_amountneeded); //Send cTokens from Vault to ProviderContract
        cToken.borrow(_borrowAmount); //Compound Protocol
        ERC20token.transfer(msg.sender,_borrowAmount); //Transfer borrowed erc20 Tokens to the Vault
      }
    }/*end of borrow function*/

    function payback(address _borrowAsset, uint256 _borrowAmount) external virtual payable {
      require(ismapped(_borrowAsset), "Missing mapping ERC20 to cToken");
      if(isETH(_borrowAsset)) { /*Compound payback Procedure for ETH*/
        require(msg.value != 0, "Missing msg.value");
        require(_borrowAmount == msg.value, "Verify msg.value amount vs _borrowAmount indicated");

        CEth cToken = CEth(erc20TocToken[_borrowAsset]); // Create a reference to the corresponding cToken contract
        cToken.repayBorrow{value:msg.value}();

        //Calculate unlocked cTokens due to payback
        uint256 exchangeRate = cToken.exchangeRateCurrent(); //Get exchange rate ctoken per underlying
        uint256 cToken_unlocked = (msg.value).div(exchangeRate);

        cToken.transfer(msg.sender, cToken_unlocked);  //Return unlocked ctokens back to the Vault

      } else { /*Compound payback Procedure for a ERC20 Token*/

        IERC20 ERC20token = IERC20(_borrowAsset); // Create reference to the ERC20 contract
        CErc20 cToken = CErc20(erc20TocToken[_borrowAsset]); // Create a reference to the corresponding cToken contract

        ERC20token.approve(erc20TocToken[_borrowAsset], _borrowAmount);
        cToken.repayBorrow(_borrowAmount);

        //Calculate unlocked cTokens due to payback
        uint256 exchangeRate = cToken.exchangeRateCurrent(); //Get exchange rate ctoken per underlying
        uint256 cToken_unlocked = _borrowAmount.div(exchangeRate);

        cToken.transfer(msg.sender, cToken_unlocked); //Return unlocked ctokens back to the Vault

      }

    } /*end of payback function*/


    //internal Functions

    function getCollateralFactor(address  _cTokenAddress) internal returns(uint256, uint256) {
      Comptroller Cptrllr = Comptroller(comptroller); // Create a reference to the corresponding network Comptroller
      (bool isListed, uint factorMantissa) = Cptrllr.markets(_cTokenAddress); //Call comptroller for information
      uint256 base = 1000000000000000000; //Compound Protocol constant, for collateral factor num operations
      return (factorMantissa, base);
    }
    function isETH(address token) internal pure returns (bool) {
    return (token == address(0) || token == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
    }
    function ismapped(address _Asset) internal view returns(bool) {
      if (erc20TocToken[_Asset] == address(0)){
        return false;
      } else {
        return true;
      }
    }

    function includeSafetyFactorCollateral(uint256 _number) internal view returns(uint){
      return (_number.mul(safetyFactor.a)).div(safetyFactor.a);
    }

    function openDebtPosition(address borrowAsset) internal {
      OpPositions[borrowAsset] += 1;
    }

    function closeDebtPosition(address borrowAsset) internal {
      OpPositions[borrowAsset] -= 1;
    }

    receive() external payable {}


    /* THESE ARE TEST ONLY FUNCTIONS*/


      function manualETHwithdraw(uint amount) public payable returns(uint) {
      //check balance of msg.sender is sufficient.
      require(msg.sender == theVault, "You are not the Vault");
      theVault.transfer(amount);
      return address(this).balance;
      }

      function detroyme() public payable {
        require(msg.sender == theVault, "Only theVault can destroy this smartcontract!");
        theVault.transfer(address(this).balance);
        selfdestruct(theVault); //Send remaining ETh to theVault if any left.
      }

      function manualtransferERC20(address _erc20Address, uint amountToken) public {
        require(msg.sender == theVault, "You are not the Vault");
        IERC20 erc20Token = IERC20(_erc20Address);
        erc20Token.transfer(theVault, amountToken);
      }

      function getPrice(address _priceFeedAddress, address _ctoken_address ) public view returns(uint256){
         PriceFeed pFeed = PriceFeed(_priceFeedAddress); // Create a reference to the corresponding network PriceFeedContract
         return pFeed.getUnderlyingPrice(_ctoken_address);
      }

}

/*
MAINNET COMPTROLLER: 0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B
PRICE FEED: 0x922018674c12a7f0d394ebeef9b58f186cde13c1
MAINNET COMPTROLLER MARKETS
[
0x6C8c6b02E7b2BE14d4fA6022Dfd6d75921D90E4E, cBat
0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643, cDAI
0x158079Ee67Fce2f58472A96584A73C7Ab9AC95c1, cREP
0xF5DCe57282A584D2746FaF1593d3121Fcac444dC, cSAI
0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5, cETH
0x39AA39c021dfbaE8faC545936693aC917d5E7563, cUSDC
0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9, cUSDT
0xC11b1268C1A384e55C48c2391d8d480264A3A7F4, cWBTC
0xB3319f5D18Bc0D84dD1b4825Dcde5d5f7266d407, cZRX
0x35a18000230da775cac24873d00ff85bccded550, cUNI
0x70e36f6bf80a52b3b46b3af8e106cc0ed743e8e4, cCOMP
]
*/

/*
KOVAN COMPTROLLER: 0x5eae89dc1c671724a672ff0630122ee834098657
PRICE FEED: 0xbBdE93962Ca9fe39537eeA7380550ca6845F8db7
KOVAN COMPTROLLER MARKETS
[
0x4a77fAeE9650b09849Ff459eA1476eaB01606C7a, cBat
0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD, cDAI
0xA4eC170599a1Cf87240a35b9B1B8Ff823f448b57, cREP
0xb3f7fB482492f4220833De6D6bfCC81157214bEC, cSAI
0x41B5844f4680a8C38fBb695b7F9CFd1F64474a72, cETH
0x4a92E71227D294F041BD82dd8f78591B75140d63, cUSDC
0x3f0A0EA2f86baE6362CF9799B523BA06647Da018, cUSDT
0xa1fAA15655B0e7b6B6470ED3d096390e6aD93Abb, cWBTC
0xAf45ae737514C8427D373D50Cd979a242eC59e5a, cZRX
]
*/
