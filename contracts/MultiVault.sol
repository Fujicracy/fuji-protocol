// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { IDebtToken } from "./IDebtToken.sol";
import { MultiVaultBase } from "./MultiVaultBase.sol";
import { IMultiVault } from "./IMultiVault.sol";
import { IProvider } from "./IProvider.sol";
import { Flasher } from "./flashloans/Flasher.sol";
import { AlphaWhitelist } from "./AlphaWhitelist.sol";
import {Errors} from './Debt-token/Errors.sol';

import "hardhat/console.sol"; //test line

//interface IController {
  //function doControllerRoutine(address _vault) external returns(bool);
//}

contract MultiVault is IMultiVault, MultiVaultBase, AlphaWhitelist {

  AggregatorV3Interface public oracle;

  //Base Struct Object to define Safety factor
  //a divided by b represent the factor example 1.2, or +20%, is (a/b)= 6/5
  struct Factor {
    uint256 a;
    uint256 b;
  }

  //Safety factor
  Factor private safetyF;

  //Collateralization factor
  Factor private collatF;
  uint256 internal constant BASE = 1e18;

  //Managing Lending Protocol Providers
  address[] public providers;
  address public override activeProvider;

  //BorrowAsset to Debt Token mapping
  mapping (address => address) public override debtToken;

  address public controller;
  address public fliquidator;
  Flasher flasher;

  //Mapping of User Collaterals, user => collateral asset => balance
  mapping(address => mapping(address => uint256)) public UserBalcollaterals;

  modifier isAuthorized() {
    require(msg.sender == controller ||
      msg.sender == fliquidator ||
      msg.sender == address(this) ||
      msg.sender == address(flasher) ||
      msg.sender == owner(),
      Errors.VL_NOT_AUTHORIZED);
    _;
  }

  constructor (

    address _controller,
    address _fliquidator,
    address _oracle,
    uint256 _limitusers

  ) public {

    LIMIT_USERS = _limitusers; //alpha

    controller = _controller;
    fliquidator =_fliquidator;

    whitelisted[101] = fliquidator; //alpha
    reversedwhitelisted[fliquidator] = 101; //alpha

    oracle = AggregatorV3Interface(_oracle);

    collateralAssets[address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)] = true; // ETH
    //collateralAssets[address(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599)] = true; // WBTC
    numCollateralsAssets = 2;
    borrowAssets[address(0x6B175474E89094C44Da98b954EedeAC495271d0F)] = true; // DAI
    borrowAssets[address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)] = true; // USDC
    numBorrowAssets = 2;

    // + 5%
    safetyF.a = 21;
    safetyF.b = 20;

    // 125%
    collatF.a = 5;
    collatF.b = 4;
  }

  //Core functions

  /**
  * @dev Deposits collateral and borrows underlying in a single function call from activeProvider
  * @param _collateralAmount: amount to be deposited
  * @param _borrowAmount: amount to be borrowed
  */
  function depositAndBorrow(
    uint256 _collateralAsset,
    uint256 _collateralAmount,
    uint256 _borrowAsset,
    uint256 _borrowAmount
  ) external payable {
    deposit(_collateralAsset, _collateralAmount);
    borrow(_borrowAsset, _borrowAmount);
  }

  /**
  * @dev Deposit a collateral type to activeProvider
  * @param _collateralAsset: ERC20 address of collateral to be deposited
  * @param _collateralAmount: to be deposited
  * Emits a {Deposit} event.
  */
  function deposit(address _collateralAsset, uint256 _collateralAmount) public override isWhitelisted payable {

    require(collateralAssets[_collateralAsset] = true, Errors.VL_INVALID_COLLATERAL);
    require(_collateralAmount > 0, Errors.VL_AMOUNT_ERROR);

    if (isETH(IERC20(_collateralAsset))) {

      require(msg.value == _collateralAmount, Errors.VL_AMOUNT_ERROR);
      require(msg.value <= ETH_CAP_VALUE, Errors.SP_ALPHA_ETH_CAP_VALUE);//Alpha

    } else {

      require(
        IERC20(_collateralAsset).balanceOf(msg.sender)
        >= _collateralAmount,
        Errors.VL_NO_ERC20_BALANCE
      );

      require(
        IERC20(_collateralAsset).allowance(msg.sender, address(this))
        >= _repayAmount,
        Errors.VL_MISSING_ERC20_ALLOWANCE
      );
    }

    //Deposit to current provider
    _deposit(_collateralAmount, address(activeProvider), _collateralAsset);

    balanceCollateralMarket[_collateralAsset] = (balanceCollateralMarket[_collateralAsset]).add(_collateralAmount);

    uint256 providedCollateral = UserBalcollaterals[msg.sender][_collateralAsset];
    collaterals[msg.sender][_collateralAsset] = providedCollateral.add(_collateralAmount);

    emit Deposit(msg.sender, _collateralAmount, _collateralAsset);

  }

  /**
  * @dev Withdraws a collateral type
  * call Controller checkrates
  * @param _withdrawAmount: amount of collateral to withdraw
  * Emits a {Withdraw} event.
  */
  function withdraw(address _collateralAsset, uint256 _withdrawAmount) public override isWhitelisted {

    uint256 providedCollateral = UserBalcollaterals[msg.sender][_collateralAsset];

    require(providedCollateral >= _withdrawAmount, Errors.VL_INVALID_WITHDRAW_AMOUNT);
    // get needed collateral for current position
    // according current price
    uint256 neededCollateral = getNeededCollateralFor(
      IDebtToken(debtToken).balanceOf(msg.sender)
    );

    require(providedCollateral.sub(_withdrawAmount) >= neededCollateral, Errors.VL_INVALID_WITHDRAW_AMOUNT);

    // withdraw collateral from current provider
    _withdraw(_withdrawAmount, address(activeProvider));

    collaterals[msg.sender] = providedCollateral.sub(_withdrawAmount);
    IERC20(collateralAsset).uniTransfer(msg.sender, _withdrawAmount);
    collateralBalance = collateralBalance.sub(_withdrawAmount);

    emit Withdraw(msg.sender, _withdrawAmount);

  }

  /**
  * @dev Borrows Vault's type underlying amount from activeProvider
  * @param _borrowAmount: token amount of underlying to borrow
  * Emits a {Borrow} event.
  */
  function borrow(uint256 _borrowAmount) public override isWhitelisted  {

    uint256 providedCollateral = collaterals[msg.sender];

    // get needed collateral for already existing positions
    // together with the new position
    // according current price
    uint256 neededCollateral = getNeededCollateralFor(
      _borrowAmount.add(IDebtToken(debtToken).balanceOf(msg.sender))
    );

    require(providedCollateral > neededCollateral, Errors.VL_INVALID_BORROW_AMOUNT);

    updateDebtTokenBalances();

    // borrow from the current provider
    _borrow(_borrowAmount, address(activeProvider));

    IERC20(borrowAsset).uniTransfer(msg.sender, _borrowAmount);

    IDebtToken(debtToken).mint(msg.sender,msg.sender,_borrowAmount);

    emit Borrow(msg.sender, _borrowAmount);
  }

  /**
  * @dev Paybacks Vault's type underlying to activeProvider
  * @param _repayAmount: token amount of underlying to repay
  * Emits a {Repay} event.
  */
  function payback(uint256 _repayAmount) public override isWhitelisted payable {
    updateDebtTokenBalances();

    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(msg.sender);
    require(userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);

    require(
      IERC20(borrowAsset).allowance(msg.sender, address(this))
      >= _repayAmount,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );

    IERC20(borrowAsset).transferFrom(msg.sender, address(this), _repayAmount);

    // payback current provider
    _payback(_repayAmount, address(activeProvider));

    IDebtToken(debtToken).burn(msg.sender,_repayAmount);

    emit Repay(msg.sender, _repayAmount);
  }

  /**
  * @dev Changes Vault debt and collateral to newProvider, called by Flasher
  * @param _newProvider new provider's address
  * @param _flashLoanDebt amount of flashloan underlying to repay Flashloan
  * Emits a {Switch} event.
  */
  function executeSwitch(address _newProvider,uint256 _flashLoanDebt) public override isAuthorized {
    // TODO make callable only from Flasher
    uint256 borrowBalance = borrowBalance(activeProvider);

    require(
      IERC20(borrowAsset).allowance(msg.sender, address(this)) >= borrowBalance,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );

    IERC20(borrowAsset).transferFrom(msg.sender, address(this), borrowBalance);

    // 1. payback current provider
    _payback(borrowBalance, address(activeProvider));

    // 2. withdraw collateral from current provider
    _withdraw(collateralBalance, address(activeProvider));

    // 3. deposit to the new provider
    _deposit(collateralBalance, address(_newProvider));

    // 4. borrow from the new provider, borrowBalance + premium = flashloandebt
    _borrow(_flashLoanDebt, address(_newProvider));

    updateDebtTokenBalances();

    // return borrowed amount to Flasher
    IERC20(borrowAsset).uniTransfer(msg.sender, _flashLoanDebt);

    emit Switch(activeProvider, _newProvider);
  }

  //Setter, change state functions

  /**
  * @dev Sets a new active provider for the Vault
  * @param _provider: fuji address of the new provider
  * Emits a {SetActiveProvider} event.
  */
  function setActiveProvider(address _provider) external override isAuthorized {
    activeProvider = _provider;

    emit SetActiveProvider(_provider);
  }

  /**
  * @dev Set the collateral balance provided by a User.
  * @param _user: Address of the user
  * @param _collateralasset: Address of the collateral asset
  * @param _newValue: new value
  */
  function setUsercollateral(address _user, address _collateralasset, uint256 _newValue) external override isAuthorized {
    Usercollaterals[_user][_collateralasset] = _newValue;
  }

  //Administrative functions

  /**
  * @dev Sets the debt token address for a borrowAsset.
  * @param _borrowAsset: borrow asset address
  * @param _debtToken: fuji debt token address
  */
  function setDebtToken(address _borrowAsset,address _debtToken) external isAuthorized {
    debtToken[_borrowAsset] = _debtToken;
  }

  /**
  * @dev Sets the flasher for this vault.
  * @param _flasher: flasher address
  */
  function setFlasher(address _flasher) external isAuthorized {
    flasher = Flasher(_flasher);
  }

  /**
  * @dev Sets the Collateral balance for this vault, after a change.
  * @param _newCollateralBalance: New balance value
  */
  function setVaultCollateralBalance(address _collateralasset, uint256 _newCollateralBalance) external override isAuthorized {
    balanceCollateralMarket[_collateralasset] = _newCollateralBalance;
  }

  /**
  * @dev Adds a provider to the Vault
  * @param _provider: new provider fuji address
  */
  function addProvider(address _provider) external isAuthorized {
    bool alreadyIncluded = false;

    //Check if Provider is not already included
    for (uint i = 0; i < providers.length; i++) {
      if (providers[i] == _provider) {
        alreadyIncluded = true;
      }
    }
    require(!alreadyIncluded, Errors.VL_PROVIDER_ALREADY_ADDED);

    //Push new provider to provider array
    providers.push(_provider);

    //Asign an active provider if none existed
    if (providers.length == 1) {
      activeProvider = _provider;
    }
  }

  /**
  * @dev Update the Debt Token Balances
  * @param _borrowAsset: borrow asset
  */
  function updateDebtTokenBalances(address _borrowAsset) public override {
    address debtTok = debtToken[_borrowAsset];
    IDebtToken(debtTok).updateState(borrowBalance(activeProvider));
  }


  //Getter Functions

  /**
  * @dev Get the collateral provided for a User.
  * @param _user: Address of the user
  */
  function getUsercollateral(address _user, address _collateralasset) external view override returns(uint256){
    return UserBalcollaterals[_user][_collateralasset];
  }

  /**
  * @dev Returns an array of the Vault's providers
  */
  function getProviders() external view override returns(address[] memory) {
    return providers;
  }

  /**
  * @dev Getter for vault's collateral asset address.
  * @return collateral asset address
  */
  function getCollateralAsset() external view override returns(address) {
    return address(collateralAsset);
  }

  /**
  * @dev Getter for vault's borrow asset address.
  * @return borrow asset address
  */
  function getBorrowAsset() external view override returns(address) {
    return address(borrowAsset);
  }

  /**
  * @dev Gets the collateral balance
  */
  function getcollateralBalance() external override view returns(uint256) {
    return collateralBalance;
  }

  /**
  * @dev Get the flasher for this vault.
  */
  function getFlasher() external view override returns(address) {
    return address(flasher);
  }

  /**
  * @dev Returns an amount to be paid as bonus for liquidation
  * @param _amount: Vault underlying type intended to be liquidated
  * @param _flash: Flash or classic type of liquidation, bonus differs
  */
  function getLiquidationBonusFor(
    uint256 _amount,
    bool _flash
  ) external view override returns(uint256) {
    // get price of DAI in ETH
    (,int256 latestPrice,,,) = oracle.latestRoundData();
    uint256 p = _amount.mul(uint256(latestPrice));

    if (_flash) {
      // 1/25 or 4%
      return p.mul(1).div(25).div(BASE);
    }
    else {
      // 1/20 or 5%
      return p.mul(1).div(20).div(BASE);
    }
  }

  /**
  * @dev Returns the amount of collateral needed, including safety factors
  * @param _amount: Vault underlying type intended to be borrowed
  */
  function getNeededCollateralFor(uint256 _amount) public view override returns(uint256) {
    // get price of DAI in ETH
    (,int256 latestPrice,,,) = oracle.latestRoundData();
    return _amount.mul(uint256(latestPrice))
        // 5/4 or 125% collateralization factor
        .mul(collatF.a)
        .div(collatF.b)
        // 21/20 or + 5% safety factor
        .mul(safetyF.a)
        .div(safetyF.b)
        .div(BASE);
  }

  /**
  * @dev Returns the amount of collateral of a user address
  * @param _user: address of the user
  */
  function getCollateralShareOf(address _user) public view returns(uint256 share) {
    uint256 providedCollateral = collaterals[_user];
    if (providedCollateral == 0) {
      share = 0;
    }
    else {
      share = providedCollateral.mul(BASE).div(collateralBalance);
    }
  }

  /**
  * @dev Returns the total borrow balance of the Vault's  underlying at provider
  * @param _provider: address of a provider
  */
  function borrowBalance(address _provider) public view override returns(uint256) {
    return IProvider(_provider).getBorrowBalance(borrowAsset);
  }

  /**
  * @dev Returns the total deposit balance of the Vault's type collateral at provider
  * @param _provider: address of a provider
  */
  function depositBalance(address _provider) public view override returns(uint256) {
    uint256 balance = IProvider(_provider).getDepositBalance(collateralAsset);
    console.log("at vaul", balance);
    return balance;
  }

  receive() external payable {}
}
