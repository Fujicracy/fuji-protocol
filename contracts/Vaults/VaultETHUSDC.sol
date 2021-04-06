// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { IFujiERC1155 } from "./IFujiERC1155.sol";
import { VaultBase } from "./VaultBase.sol";
import { IVault } from "./IVault.sol";
import { IProvider } from "./IProvider.sol";
import { Flasher } from "./flashloans/Flasher.sol";
import { Errors } from './Debt-token/Errors.sol';

import "hardhat/console.sol"; //test line

interface IAlphaWhitelist {

  function ETH_CAP_VALUE() external view returns(uint256);
  function isAddrWhitelisted(address _usrAddrs) external view returns(bool);

}

interface IAccountant {

  function ETH_CAP_VALUE() external view returns(uint256);
  function isAddrWhitelisted(address _usrAddrs) external view returns(bool);

}

contract VaultETHUSDC is IVault, VaultBase {

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

  //State variables
  address[] public providers;
  address public override activeProvider;

  address public FujiERC1155;

  address public controller;
  address public fliquidator;
  Flasher flasher;

  IAlphaWhitelist aWhitelist;

  mapping(address => uint256) public collaterals;

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
    address _aWhitelist

  ) public {

    controller = _controller;
    fliquidator =_fliquidator;
    aWhitelist = IAlphaWhitelist(_aWhitelist);

    oracle = AggregatorV3Interface(_oracle);

    collateralAsset = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE); // ETH
    borrowAsset = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48); // USDC

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
  function depositAndBorrow(uint256 _collateralAmount, uint256 _borrowAmount) external payable {
    deposit(_collateralAmount);
    borrow(_borrowAmount);
  }

  /**
  * @dev Deposit Vault's type collateral to activeProvider
  * call Controller checkrates
  * @param _collateralAmount: to be deposited
  * Emits a {Deposit} event.
  */
  function deposit(uint256 _collateralAmount) public override payable {

    require(aWhitelist.isAddrWhitelisted(msg.sender), Errors.SP_ALPHA_ADDR_NOT_WHTLIST);
    require(msg.value == _collateralAmount, Errors.VL_AMOUNT_ERROR);
    require(msg.value <= aWhitelist.ETH_CAP_VALUE(), Errors.SP_ALPHA_ETH_CAP_VALUE);//Alpha

    // deposit to current provider
    _deposit(_collateralAmount, address(activeProvider));

    uint256 id = IFujiERC1155(FujiERC1155).getAssetID(0, collateralAsset);

    IFujiERC1155(FujiERC1155).mint(msg.sender, id, _collateralAmount, "");

    emit Deposit(msg.sender, _collateralAmount);

  }

  /**
  * @dev Withdraws Vault's type collateral from activeProvider
  * call Controller checkrates
  * @param _withdrawAmount: amount of collateral to withdraw
  * Emits a {Withdraw} event.
  */
  function withdraw(uint256 _withdrawAmount) public override {

    require(aWhitelist.isAddrWhitelisted(msg.sender), Errors.SP_ALPHA_ADDR_NOT_WHTLIST); //alpha

    uint256 idcollateral = IFujiERC1155(FujiERC1155).getAssetID(0, collateralAsset);
    uint256 idborrow = IFujiERC1155(FujiERC1155).getAssetID(1, borrowAsset);

    uint256 providedCollateral = IFujiERC1155(FujiERC1155).balanceOf(msg.sender, idcollateral);

    require(providedCollateral >= _withdrawAmount, Errors.VL_INVALID_WITHDRAW_AMOUNT);
    // get needed collateral for current position
    // according current price
    uint256 neededCollateral = getNeededCollateralFor(IFujiERC1155(FujiERC1155).balanceOf(msg.sender,idborrow));

    require(providedCollateral.sub(_withdrawAmount) >= neededCollateral, Errors.VL_INVALID_WITHDRAW_AMOUNT);

    // withdraw collateral from current provider
    _withdraw(_withdrawAmount, address(activeProvider));

    IFujiERC1155(FujiERC1155).burn(msg.sender, idborrow, _withdrawAmount);

    IERC20(collateralAsset).uniTransfer(msg.sender, _withdrawAmount);

    emit Withdraw(msg.sender, _withdrawAmount);

  }

  /**
  * @dev Borrows Vault's type underlying amount from activeProvider
  * @param _borrowAmount: token amount of underlying to borrow
  * Emits a {Borrow} event.
  */
  function borrow(uint256 _borrowAmount) public override {

    require(aWhitelist.isAddrWhitelisted(msg.sender), Errors.SP_ALPHA_ADDR_NOT_WHTLIST); //alpha

    uint256 idcollateral = IFujiERC1155(FujiERC1155).getAssetID(0, collateralAsset);
    uint256 idborrow = IFujiERC1155(FujiERC1155).getAssetID(1, borrowAsset);

    uint256 providedCollateral = IFujiERC1155(FujiERC1155).balanceOf(msg.sender, idcollateral);

    // get needed collateral for already existing positions
    // together with the new position
    // according current price
    uint256 neededCollateral = getNeededCollateralFor(
      _borrowAmount.add(IFujiERC1155(FujiERC1155).balanceOf(msg.sender,idborrow))
    );

    require(providedCollateral > neededCollateral, Errors.VL_INVALID_BORROW_AMOUNT);

    //updateFujiERC1155Balances(); to implement soon

    // borrow from the current provider
    _borrow(_borrowAmount, address(activeProvider));

    IERC20(borrowAsset).uniTransfer(msg.sender, _borrowAmount);

    IFujiERC1155(FujiERC1155).mint(msg.sender, idborrow, _borrowAmount, "");

    emit Borrow(msg.sender, _borrowAmount);
  }

  /**
  * @dev Paybacks Vault's type underlying to activeProvider
  * @param _repayAmount: token amount of underlying to repay
  * Emits a {Repay} event.
  */
  function payback(uint256 _repayAmount) public override payable {

    require(aWhitelist.isAddrWhitelisted(msg.sender), Errors.SP_ALPHA_ADDR_NOT_WHTLIST); //alpha

    //updateFujiERC1155Balances();to implement soon

    uint256 idborrow = IFujiERC1155(FujiERC1155).getAssetID(1, borrowAsset);

    uint256 userDebtBalance = IFujiERC1155(FujiERC1155).balanceOf(msg.sender,idborrow);
    require(userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);

    require(
      IERC20(borrowAsset).allowance(msg.sender, address(this))
      >= _repayAmount,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );

    IERC20(borrowAsset).transferFrom(msg.sender, address(this), _repayAmount);

    // payback current provider
    _payback(_repayAmount, address(activeProvider));

    IFujiERC1155(FujiERC1155).burn(msg.sender,idborrow,_repayAmount);

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
    uint256 collateralBalance = depositBalance(activeProvider);
    _withdraw(collateralBalance, address(activeProvider));

    // 3. deposit to the new provider
    _deposit(collateralBalance, address(_newProvider));

    // 4. borrow from the new provider, borrowBalance + premium = flashloandebt
    _borrow(_flashLoanDebt, address(_newProvider));

    //updateFujiERC1155Balances(); to be implemented soon

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
  * @dev Get the collateral provided for a User.
  * @param _user: Address of the user
  */
  function setUsercollateral(address _user, uint256 _newValue) external override isAuthorized {
    collaterals[_user] = _newValue;
  }

  //Administrative functions

  /**
  * @dev Sets a fujiERC1155 Colalterl and Borrow manager for this vault.
  * @param _FujiERC1155: fuji ERC1155 address
  */
  function setFujiERC1155(address _FujiERC1155) external isAuthorized {
    FujiERC1155 = _FujiERC1155;
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
  //function setVaultCollateralBalance(uint256 _newCollateralBalance) external override isAuthorized {
  //  collateralBalance = _newCollateralBalance;
  //}

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

  //function updateFujiERC1155Balances() public override {
  //  IFujiERC1155(FujiERC1155).updateState(borrowBalance(activeProvider));
  //} to implement soon


  //Getter Functions

  /**
  * @dev Get the collateral provided for a User.
  * @param _user: Address of the user
  */
  function getUsercollateral(address _user) external view override returns(uint256){
    return collaterals[_user];
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
  //function getcollateralBalance() external override view returns(uint256) {
  //  return collateralBalance;
  //}

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
  //function getCollateralShareOf(address _user) public view returns(uint256 share) {
  //  uint256 providedCollateral = collaterals[_user];
  //  if (providedCollateral == 0) {
  //    share = 0;
  //  }
  //  else {
  //    share = providedCollateral.mul(BASE).div(collateralBalance);
  //  }
  //}

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
    return balance;
  }

  receive() external payable {}
}
