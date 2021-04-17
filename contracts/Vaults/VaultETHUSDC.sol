// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IFujiERC1155 } from "../FujiERC1155/IFujiERC1155.sol";
import { IVault } from "./IVault.sol";
import { VaultBase } from "./VaultBase.sol";
import { IProvider } from "../Providers/IProvider.sol";
import { Errors } from "../Libraries/Errors.sol";

import "hardhat/console.sol"; //test line

interface IAlphaWhitelist {

  function ETH_CAP_VALUE() external view returns(uint256);
  function isAddrWhitelisted(address _usrAddrs) external view returns(bool);

}

contract VaultETHDAI is IVault, VaultBase, ReentrancyGuard {

  uint256 internal constant BASE = 1e18;

  // Base Struct Object to define a factor
  struct Factor {
    uint64 a;
    uint64 b;
  }

  // Safety factor
  Factor public safetyF;

  // Collateralization factor
  Factor public collatF;

  // Bonus Factor for Flash Liquidation
  Factor public bonusFlashL;

  // Bonus Factor for normal Liquidation
  Factor public bonusL;


  //State variables
  address[] public providers;
  address public override activeProvider;

  address public FujiERC1155;

  address private ftreasury;
  address public controller;
  address public fliquidator;
  address public flasher;
  IAlphaWhitelist aWhitelist;
  AggregatorV3Interface public oracle;

  mapping(address => uint256) public collaterals;

  modifier isAuthorized() {
    require(
      msg.sender == controller ||
      msg.sender == address(this) ||
      msg.sender == owner(),
      Errors.VL_NOT_AUTHORIZED);
    _;
  }

  modifier onlyFlash() {
  require(
    msg.sender == flasher ||
    msg.sender == fliquidator,
    Errors.VL_NOT_AUTHORIZED);
  _;
}

  constructor (

    address _controller,
    address _fliquidator,
    address _flasher,
    address _oracle,
    address _aWhitelist,
    address _ftreasury

  ) public {

    controller = _controller;
    fliquidator =_fliquidator;
    flasher = _flasher;
    aWhitelist = IAlphaWhitelist(_aWhitelist);
    ftreasury = _ftreasury;

    oracle = AggregatorV3Interface(_oracle);

    vAssets.collateralAsset = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE); // ETH
    vAssets.borrowAsset = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48); // USDC

    // 1.05
    safetyF.a = 21;
    safetyF.b = 20;

    // 1.269
    collatF.a = 80;
    collatF.b = 63;

    // 0.04
    bonusFlashL.a = 1;
    bonusFlashL.b = 25;

    // 0.05
    bonusL.a = 1;
    bonusL.b = 20;

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
  * @dev Paybacks the underlying asset and withdraws collateral in a single function call from activeProvider
  * @param _paybackAmount: amount of underlying asset to be payback, pass -1 to pay full amount
  * @param _collateralAmount: amount of collateral to be withdrawn, pass -1 to withdraw maximum amount
  */
  function paybackAndWithdraw(int256 _paybackAmount, int256 _collateralAmount) external payable {
    payback(_paybackAmount);
    withdraw(_collateralAmount);
  }

  /**
  * @dev Deposit Vault's type collateral to activeProvider
  * call Controller checkrates
  * @param _collateralAmount: to be deposited
  * Emits a {Deposit} event.
  */
  function deposit(uint256 _collateralAmount) public override payable {

    //Alpha check if User Address is Whitelisted
    require(aWhitelist.isAddrWhitelisted(msg.sender), Errors.SP_ALPHA_ADDR_NOT_WHTLIST);

    require(msg.value == _collateralAmount, Errors.VL_AMOUNT_ERROR);

    // Whitelisting Cap Check
    require(
      msg.value <= aWhitelist.ETH_CAP_VALUE() &&
      uint256(msg.value).add(IFujiERC1155(FujiERC1155).balanceOf(msg.sender, vAssets.collateralID)) <= aWhitelist.ETH_CAP_VALUE(),
      Errors.SP_ALPHA_ETH_CAP_VALUE
    );

    // Delegate Call Deposit to current provider
    _deposit(_collateralAmount, address(activeProvider));

    // Collateral Management
    IFujiERC1155(FujiERC1155).mint(msg.sender, vAssets.collateralID, _collateralAmount, "");

    emit Deposit(msg.sender, vAssets.collateralAsset ,_collateralAmount);
  }

  /**
  * @dev Withdraws Vault's type collateral from activeProvider
  * call Controller checkrates
  * @param _withdrawAmount: amount of collateral to withdraw
  * otherwise pass -1 to withdraw maximum amount possible of collateral (including safety factors)
  * Emits a {Withdraw} event.
  */
  function withdraw(int256 _withdrawAmount) public override nonReentrant {

    // If call from Normal User do typical, otherwise Fliquidator
    if(msg.sender != fliquidator) {

      // Alpha check if Address is Whitelisted
      require(aWhitelist.isAddrWhitelisted(msg.sender), Errors.SP_ALPHA_ADDR_NOT_WHTLIST);

      _updateF1155Balances();

      // Get User Collateral in this Vault
      uint256 providedCollateral = IFujiERC1155(FujiERC1155).balanceOf(msg.sender, vAssets.collateralID);

      // Get Required Collateral with Factors to maintain debt position healthy
      uint256 neededCollateral = getNeededCollateralFor(
        IFujiERC1155(FujiERC1155).balanceOf(msg.sender,vAssets.borrowID),
        true
      );

      // If passed argument amount is negative do MAX
      if (_withdrawAmount < 0) {

        // Compute the maximum Withdrawal Amount
        uint256 maxWithdrawalAmount = providedCollateral.sub(neededCollateral);

        // Check Provided Collateral is greater than intended Withdrawal Amount
        require(providedCollateral >= maxWithdrawalAmount, Errors.VL_INVALID_WITHDRAW_AMOUNT);

        // Collateral Management
        IFujiERC1155(FujiERC1155).burn(msg.sender, vAssets.collateralID, maxWithdrawalAmount);

        // Delegate Call Withdraw to current provider
        _withdraw(maxWithdrawalAmount, address(activeProvider));

        // Transer Assets to User
        IERC20(vAssets.collateralAsset).uniTransfer(msg.sender, maxWithdrawalAmount);

        emit Withdraw(msg.sender, vAssets.collateralAsset, maxWithdrawalAmount);

      } else {

        // Check Withdrawal is Greater than Zero
        require(_withdrawAmount > 0, Errors.VL_AMOUNT_ERROR);

        // Check Provided Collateral is greater than intended Withdrawal Amount
        require(
          providedCollateral >= uint256(_withdrawAmount),
          Errors.VL_INVALID_WITHDRAW_AMOUNT
        );

        // Check User will not fall undercollaterized
        require(
          providedCollateral.sub(uint256(_withdrawAmount)) >= neededCollateral,
          Errors.VL_INVALID_WITHDRAW_AMOUNT
        );

        // Collateral Management
        IFujiERC1155(FujiERC1155).burn(msg.sender, vAssets.collateralID, uint256(_withdrawAmount));

        // Delegate Call Withdraw to current provider
        _withdraw(uint256(_withdrawAmount), address(activeProvider));

        // Transer Assets to User
        IERC20(vAssets.collateralAsset).uniTransfer(msg.sender, uint256(_withdrawAmount));

        emit Withdraw(msg.sender, vAssets.collateralAsset, uint256(_withdrawAmount));

      }

    } else if(msg.sender == fliquidator) {

    // Logic used when called by Fliquidator
    _withdraw(uint256(_withdrawAmount), address(activeProvider));
    IERC20(vAssets.collateralAsset).uniTransfer(msg.sender, uint256(_withdrawAmount));

    }

  }

  /**
  * @dev Borrows Vault's type underlying amount from activeProvider
  * @param _borrowAmount: token amount of underlying to borrow
  * Emits a {Borrow} event.
  */
  function borrow(uint256 _borrowAmount) public override nonReentrant {

    // Alpha check if User Address is Whitelisted
    require(aWhitelist.isAddrWhitelisted(msg.sender), Errors.SP_ALPHA_ADDR_NOT_WHTLIST);

    _updateF1155Balances();

    uint256 providedCollateral = IFujiERC1155(FujiERC1155).balanceOf(msg.sender, vAssets.collateralID);

    // Get Required Collateral with Factors to maintain debt position healthy
    uint256 neededCollateral = getNeededCollateralFor(
      _borrowAmount.add(IFujiERC1155(FujiERC1155).balanceOf(msg.sender,vAssets.borrowID))
    );

    // Check Provided Collateral is greater than needed to maintain healthy position
    require(providedCollateral > neededCollateral, Errors.VL_INVALID_BORROW_AMOUNT);

    // Debt Management
    IFujiERC1155(FujiERC1155).mint(msg.sender, vAssets.borrowID, _borrowAmount, "");

    // Delegate Call Borrow to current provider
    _borrow(_borrowAmount, address(activeProvider));

    // Transer Assets to User
    IERC20(vAssets.borrowAsset).uniTransfer(msg.sender, _borrowAmount);

    emit Borrow(msg.sender, vAssets.borrowAsset, _borrowAmount);
  }

  /**
  * @dev Paybacks Vault's type underlying to activeProvider
  * @param _repayAmount: token amount of underlying to repay, or pass -1 to repay full ammount
  * Emits a {Repay} event.
  */
  function payback(int256 _repayAmount) public override payable {

    // If call from Normal User do typical, otherwise Fliquidator
    if (msg.sender != fliquidator) {

      // Alpha check if User Address is Whitelisted
      require(aWhitelist.isAddrWhitelisted(msg.sender), Errors.SP_ALPHA_ADDR_NOT_WHTLIST);

      _updateF1155Balances();

      uint256 userDebtBalance = IFujiERC1155(FujiERC1155).balanceOf(msg.sender,vAssets.borrowID);

      // Get corresponding amount of Base Protocol Debt Only
      (uint256 protocolDebt,uint256 fujidebt) = IFujiERC1155(FujiERC1155).splitBalanceOf(msg.sender,vAssets.borrowID);

      // Check User Debt is greater than Zero
      require(userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);

      // If passed argument amount is negative do MAX
      if(_repayAmount < 0) {

        // Check User Allowance
        require(
          IERC20(vAssets.borrowAsset).allowance(msg.sender, address(this))
          >= userDebtBalance,
          Errors.VL_MISSING_ERC20_ALLOWANCE
        );

        // Transfer Asset from User to Vault
        IERC20(vAssets.borrowAsset).transferFrom(msg.sender, address(this), userDebtBalance);

        // Delegate Call Payback to current provider
        _payback(protocolDebt, address(activeProvider));

        // Transfer Remaining Debt Amount to Fuji Treasury
        IERC20(vAssets.borrowAsset).transfer(ftreasury, userDebtBalance.sub(protocolDebt));

        // Debt Management
        IFujiERC1155(FujiERC1155).burn(msg.sender, vAssets.borrowID, userDebtBalance);

        emit Payback(msg.sender, vAssets.borrowAsset,userDebtBalance);

      } else {

        // Check RepayAmount is Greater than Zero
        require(_repayAmount > 0, Errors.VL_AMOUNT_ERROR);

        // Check User Allowance
        require(
          IERC20(vAssets.borrowAsset).allowance(msg.sender, address(this))
          >= uint256(_repayAmount),
          Errors.VL_MISSING_ERC20_ALLOWANCE
        );

        // Transfer Asset from User to Vault
        IERC20(vAssets.borrowAsset).transferFrom(msg.sender, address(this), uint256(_repayAmount));

        // Check Paybck amount is greater than acccrued fujiOptimized Fee interest
        require(uint256(_repayAmount).sub(fujidebt) > 0, Errors.VL_MINIMUM_PAYBACK_ERROR);

        // Delegate Call Payback to current provider, less fujiDebt
        _payback(uint256(_repayAmount).sub(fujidebt), address(activeProvider));

        // Transfer corresponding Debt Amount to Fuji Treasury
        IERC20(vAssets.borrowAsset).transfer(ftreasury, fujidebt);

        // Delegate Call Payback to current provider

        // Debt Management
        IFujiERC1155(FujiERC1155).burn(msg.sender, vAssets.borrowID, uint256(_repayAmount));

        emit Payback(msg.sender, vAssets.borrowAsset, uint256(_repayAmount));

      }

    } else if (msg.sender == fliquidator) {

      // Logic used when called by Fliquidator
      require(
        IERC20(vAssets.borrowAsset).allowance(msg.sender, address(this))
        >= uint256(_repayAmount),
        Errors.VL_MISSING_ERC20_ALLOWANCE
      );

      IERC20(vAssets.borrowAsset).transferFrom(msg.sender, address(this), uint256(_repayAmount));

      _payback(uint256(_repayAmount), address(activeProvider));

    }

  }

  /**
  * @dev Changes Vault debt and collateral to newProvider, called by Flasher
  * @param _newProvider new provider's address
  * @param _flashLoanDebt amount of flashloan underlying to repay Flashloan
  * Emits a {Switch} event.
  */
  function executeSwitch(
    address _newProvider,
    uint256 _flashLoanDebt
  ) external override onlyFlash whenNotPaused {

    uint256 borrowBalance = borrowBalance(activeProvider);

    // Check Allowance
    require(
      IERC20(vAssets.borrowAsset).allowance(msg.sender, address(this)) >= borrowBalance,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );

    // Load Flashloan Assets to Vault
    IERC20(vAssets.borrowAsset).transferFrom(msg.sender, address(this), borrowBalance);

    // Payback current provider
    _payback(borrowBalance, address(activeProvider));

    // Withdraw collateral from current provider
    uint256 collateralBalance = depositBalance(activeProvider);
    _withdraw(collateralBalance, address(activeProvider));

    // Deposit to the new provider
    _deposit(collateralBalance, address(_newProvider));

    // Borrow from the new provider, borrowBalance + premium = flashloandebt
    _borrow(_flashLoanDebt, address(_newProvider));

    // return borrowed amount to Flasher
    IERC20(vAssets.borrowAsset).uniTransfer(msg.sender, _flashLoanDebt);

    emit Switch(address(this) ,activeProvider, _newProvider);
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

  //Administrative functions

  /**
  * @dev Sets a fujiERC1155 Collateral and Debt Asset manager for this vault and initializes it.
  * @param _FujiERC1155: fuji ERC1155 address
  */
  function setFujiERC1155(address _FujiERC1155) external isAuthorized {
    FujiERC1155 = _FujiERC1155;
     vAssets.collateralID = IFujiERC1155(_FujiERC1155).addInitializeAsset(IFujiERC1155.AssetType.collateralToken, address(this));
     vAssets.borrowID = IFujiERC1155(_FujiERC1155).addInitializeAsset(IFujiERC1155.AssetType.debtToken, address(this));
  }

  /**
  * @dev Sets the flasher for this vault.
  * @param _flasher: flasher address
  */
  function setFlasher(address _flasher) external isAuthorized {
    flasher = _flasher;
  }

  /**
  * @dev Sets the controller for this vault.
  * @param _controller: controller address
  */
  function setController(address _controller) external isAuthorized {
    controller = _controller;
  }

  /**
  * @dev Sets the fliquidator address
  * @param _newfliquidator: new fliquidator address
  */
  function setfliquidator(address _newfliquidator) external isAuthorized {
    fliquidator = _newfliquidator;
  }

  /**
  * @dev Sets the Collateral Factor of this Vault
  * @dev This is means: Collateral Value / Debt Position > 1, a/b > 1
  * @param _newFactorA: Big number
  * @param _newFactorB: Small number
  */
  function setCollateralFactor(uint64 _newFactorA, uint64 _newFactorB) external isAuthorized {
    collatF.a = _newFactorA;
    collatF.b = _newFactorB;
  }

  /**
  * @dev Sets the Safety Factor of this Vault
  * @dev This is means: Collateral Value / Debt Position > 1, a/b > 1
  * @param _newFactorA: Big number
  * @param _newFactorB: Small number
  */
  function setSafetyFactor(uint64 _newFactorA, uint64 _newFactorB) external isAuthorized {
    safetyF.a = _newFactorA;
    safetyF.b = _newFactorB;
  }

  /**
  * @dev Sets the bonus factor for Flash liquidation : Should be a/b < 1
  * @param _newFactorA: Small number
  * @param _newFactorB: big number
  */
  function setbonusFlashL(uint64 _newFactorA, uint64 _newFactorB) external isAuthorized {
    bonusFlashL.a = _newFactorA;
    bonusFlashL.b = _newFactorB;
  }

  /**
  * @dev Sets the bonus factor for normal liquidation : Should be a/b < 1
  * @param _newFactorA: Small number
  * @param _newFactorB: big number
  */
  function setbonusL(uint64 _newFactorA, uint64 _newFactorB) external isAuthorized {
    bonusL.a = _newFactorA;
    bonusL.b = _newFactorB;
  }

  /**
  * @dev Sets the Oracle address (Must Comply with AggregatorV3Interface)
  * @param _newOracle: new Oracle address
  */
  function setOracle(address _newOracle) external isAuthorized {
    oracle = AggregatorV3Interface(_newOracle);
  }

  /**
  * @dev Sets the Treasury address
  * @param _newTreasury: new Fuji Treasury address
  */
  function setTreasury(address _newTreasury) external isAuthorized {
    ftreasury = _newTreasury;
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
  * @dev Overrides a porvider address at location in the providers Array
  * @param _position: position in the array
  * @param _provider: new provider fuji address
  */
  function overrideProvider(uint8 _position, address _provider) external isAuthorized {
    providers[_position] = _provider;
  }

  /**
  * @dev Internal Function to call updateState in F1155
  */
  function _updateF1155Balances() internal {
    IFujiERC1155(FujiERC1155).updateState(vAssets.borrowID, borrowBalance(activeProvider));
    IFujiERC1155(FujiERC1155).updateState(vAssets.collateralID, depositBalance(activeProvider));
  }

  /**
  * @dev External Function to call updateState in F1155
  */
  function updateF1155Balances() external override {
    _updateF1155Balances();
  }

  //Getter Functions

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
    return vAssets.collateralAsset;
  }

  /**
  * @dev Getter for vault's borrow asset address.
  * @return borrow asset address
  */
  function getBorrowAsset() external view override returns(address) {
    return vAssets.borrowAsset;
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
    uint256 p = (_amount.mul(1e12).mul(uint256(latestPrice))).div(BASE);

    if (_flash) {
      // Bonus Factors for Flash Liquidation
      return p.mul(bonusFlashL.a).div(bonusFlashL.b);
    }
    else {
      //Bonus Factors for Normal Liquidation
      return p.mul(bonusL.a).div(bonusL.b);
    }
  }

  /**
  * @dev Returns the amount of collateral needed, including or not safety factors
  * @param _amount: Vault underlying type intended to be borrowed
  * @param _withFactor: Inidicate if computation should include safety_Factors
  */
  function getNeededCollateralFor(uint256 _amount, bool _withFactor) public view override returns(uint256) {
    // Get price of DAI in ETH
    (,int256 latestPrice,,,) = oracle.latestRoundData();
    uint256 minimumReq = (_amount.mul(1e12).mul(uint256(latestPrice))).div(BASE);

    if(_withFactor) { //125% + 5%
      return minimumReq.mul(collatF.a).mul(safetyF.a).div(collatF.b).div(safetyF.b);
    } else {
      return minimumReq;
    }
  }

  /**
  * @dev Returns the total borrow balance of the Vault's  underlying at provider
  * @param _provider: address of a provider
  */
  function borrowBalance(address _provider) public view override returns(uint256) {
    return IProvider(_provider).getBorrowBalance(vAssets.borrowAsset);
  }

  /**
  * @dev Returns the total deposit balance of the Vault's type collateral at provider
  * @param _provider: address of a provider
  */
  function depositBalance(address _provider) public view override returns(uint256) {
    uint256 balance = IProvider(_provider).getDepositBalance(vAssets.collateralAsset);
    return balance;
  }

  receive() external payable {}
}
