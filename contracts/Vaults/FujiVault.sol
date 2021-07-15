// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./IVault.sol";
import "./VaultBaseUpgradeable.sol";
import "../IFujiAdmin.sol";
import "../IFujiOracle.sol";
import "../FujiERC1155/IFujiERC1155.sol";
import "../Providers/IProvider.sol";
import "../Libraries/Errors.sol";
import "../Libraries/LibUniversalERC20.sol";
import "../Interfaces/AggregatorV3Interface.sol";

interface IERC20Extended {
  function symbol() external view returns (string memory);

  function decimals() external view returns (uint8);
}

interface IVaultHarvester {
  function collectRewards(uint256 _farmProtocolNum) external returns (address claimedToken);
}

contract FujiVault is IVault, VaultBaseUpgradeable, ReentrancyGuardUpgradeable {
  using SafeERC20 for IERC20;
  using LibUniversalERC20 for IERC20;

  address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  struct Factor {
    uint64 a;
    uint64 b;
  }

  // Safety factor
  Factor public safetyF;

  // Collateralization factor
  Factor public collatF;

  //State variables
  address[] public providers;
  address public override activeProvider;

  IFujiAdmin private _fujiAdmin;
  address public override fujiERC1155;
  IFujiOracle public oracle;

  string public name;

  uint256 internal constant _BASE_DECIMAL = 18;

  modifier isAuthorized() {
    require(
      msg.sender == owner() || msg.sender == _fujiAdmin.getController(),
      Errors.VL_NOT_AUTHORIZED
    );
    _;
  }

  modifier onlyFlash() {
    require(msg.sender == _fujiAdmin.getFlasher(), Errors.VL_NOT_AUTHORIZED);
    _;
  }

  function initialize(
    address _fujiadmin,
    address _oracle,
    address _collateralAsset,
    address _borrowAsset
  ) external initializer {
    __Ownable_init();
    __Pausable_init();
    __ReentrancyGuard_init();

    _fujiAdmin = IFujiAdmin(_fujiadmin);
    oracle = IFujiOracle(_oracle);
    vAssets.collateralAsset = _collateralAsset;
    vAssets.borrowAsset = _borrowAsset;

    string memory collateralSymbol;
    string memory borrowSymbol;

    if (_collateralAsset == ETH) {
      collateralSymbol = "ETH";
    } else {
      collateralSymbol = IERC20Extended(_collateralAsset).symbol();
    }

    name = string(abi.encodePacked("Vault", collateralSymbol, borrowSymbol));

    // 1.05
    safetyF.a = 21;
    safetyF.b = 20;

    // 1.269
    collatF.a = 80;
    collatF.b = 63;
  }

  receive() external payable {}

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
  function deposit(uint256 _collateralAmount) public payable override {
    if (vAssets.collateralAsset == ETH) {
      require(msg.value == _collateralAmount && _collateralAmount != 0, Errors.VL_AMOUNT_ERROR);
    } else {
      require(_collateralAmount != 0, Errors.VL_AMOUNT_ERROR);
      IERC20(vAssets.collateralAsset).safeTransferFrom(
        msg.sender,
        address(this),
        _collateralAmount
      );
    }

    // Delegate Call Deposit to current provider
    _deposit(_collateralAmount, address(activeProvider));

    // Collateral Management
    IFujiERC1155(fujiERC1155).mint(msg.sender, vAssets.collateralID, _collateralAmount, "");

    emit Deposit(msg.sender, vAssets.collateralAsset, _collateralAmount);
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
    if (msg.sender != _fujiAdmin.getFliquidator()) {
      updateF1155Balances();

      // Get User Collateral in this Vault
      uint256 providedCollateral = IFujiERC1155(fujiERC1155).balanceOf(
        msg.sender,
        vAssets.collateralID
      );

      // Check User has collateral
      require(providedCollateral > 0, Errors.VL_INVALID_COLLATERAL);

      // Get Required Collateral with Factors to maintain debt position healthy
      uint256 neededCollateral = getNeededCollateralFor(
        IFujiERC1155(fujiERC1155).balanceOf(msg.sender, vAssets.borrowID),
        true
      );

      uint256 amountToWithdraw = _withdrawAmount < 0
        ? providedCollateral - neededCollateral
        : uint256(_withdrawAmount);

      // Check Withdrawal amount, and that it will not fall undercollaterized.
      require(
        amountToWithdraw != 0 && providedCollateral - amountToWithdraw >= neededCollateral,
        Errors.VL_INVALID_WITHDRAW_AMOUNT
      );

      // Collateral Management before Withdraw Operation
      IFujiERC1155(fujiERC1155).burn(msg.sender, vAssets.collateralID, amountToWithdraw);

      // Delegate Call Withdraw to current provider
      _withdraw(amountToWithdraw, address(activeProvider));

      // Transer Assets to User
      IERC20(vAssets.collateralAsset).univTransfer(payable(msg.sender), amountToWithdraw);

      emit Withdraw(msg.sender, vAssets.collateralAsset, amountToWithdraw);
    } else {
      // Logic used when called by Fliquidator
      _withdraw(uint256(_withdrawAmount), address(activeProvider));
      IERC20(vAssets.collateralAsset).univTransfer(payable(msg.sender), uint256(_withdrawAmount));
    }
  }

  /**
   * @dev Borrows Vault's type underlying amount from activeProvider
   * @param _borrowAmount: token amount of underlying to borrow
   * Emits a {Borrow} event.
   */
  function borrow(uint256 _borrowAmount) public override nonReentrant {
    updateF1155Balances();

    uint256 providedCollateral = IFujiERC1155(fujiERC1155).balanceOf(
      msg.sender,
      vAssets.collateralID
    );

    // Get Required Collateral with Factors to maintain debt position healthy
    uint256 neededCollateral = getNeededCollateralFor(
      _borrowAmount + IFujiERC1155(fujiERC1155).balanceOf(msg.sender, vAssets.borrowID),
      true
    );

    // Check Provided Collateral is not Zero, and greater than needed to maintain healthy position
    require(
      _borrowAmount != 0 && providedCollateral > neededCollateral,
      Errors.VL_INVALID_BORROW_AMOUNT
    );

    // Debt Management
    IFujiERC1155(fujiERC1155).mint(msg.sender, vAssets.borrowID, _borrowAmount, "");

    // Delegate Call Borrow to current provider
    _borrow(_borrowAmount, address(activeProvider));

    // Transer Assets to User
    IERC20(vAssets.borrowAsset).univTransfer(payable(msg.sender), _borrowAmount);

    emit Borrow(msg.sender, vAssets.borrowAsset, _borrowAmount);
  }

  /**
   * @dev Paybacks Vault's type underlying to activeProvider
   * @param _repayAmount: token amount of underlying to repay, or pass -1 to repay full ammount
   * Emits a {Repay} event.
   */
  function payback(int256 _repayAmount) public payable override {
    // If call from Normal User do typical, otherwise Fliquidator
    if (msg.sender != _fujiAdmin.getFliquidator()) {
      updateF1155Balances();

      uint256 userDebtBalance = IFujiERC1155(fujiERC1155).balanceOf(msg.sender, vAssets.borrowID);

      // Check User Debt is greater than Zero and amount is not Zero
      require(_repayAmount != 0 && userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);

      // TODO: Get => corresponding amount of BaseProtocol Debt and FujiDebt

      // If passed argument amount is negative do MAX
      uint256 amountToPayback = _repayAmount < 0 ? userDebtBalance : uint256(_repayAmount);

      if (vAssets.borrowAsset == ETH) {
        require(msg.value >= amountToPayback, Errors.VL_AMOUNT_ERROR);
        if (msg.value > amountToPayback) {
          IERC20(vAssets.borrowAsset).univTransfer(
            payable(msg.sender),
            msg.value - amountToPayback
          );
        }
      } else {
        // Check User Allowance
        require(
          IERC20(vAssets.borrowAsset).allowance(msg.sender, address(this)) >= amountToPayback,
          Errors.VL_MISSING_ERC20_ALLOWANCE
        );

        // Transfer Asset from User to Vault
        IERC20(vAssets.borrowAsset).transferFrom(msg.sender, address(this), amountToPayback);
      }

      // Delegate Call Payback to current provider
      _payback(amountToPayback, address(activeProvider));

      //TODO: Transfer corresponding Debt Amount to Fuji Treasury

      // Debt Management
      IFujiERC1155(fujiERC1155).burn(msg.sender, vAssets.borrowID, amountToPayback);

      emit Payback(msg.sender, vAssets.borrowAsset, userDebtBalance);
    } else {
      // Logic used when called by Fliquidator
      _payback(uint256(_repayAmount), address(activeProvider));
    }
  }

  /**
   * @dev Changes Vault debt and collateral to newProvider, called by Flasher
   * @param _newProvider new provider's address
   * @param _flashLoanAmount amount of flashloan underlying to repay Flashloan
   * Emits a {Switch} event.
   */
  function executeSwitch(
    address _newProvider,
    uint256 _flashLoanAmount,
    uint256 _fee
  ) external override onlyFlash whenNotPaused {
    // Compute Ratio of transfer before payback
    uint256 ratio = (_flashLoanAmount * 1e18) /
      (IProvider(activeProvider).getBorrowBalance(vAssets.borrowAsset));

    // Payback current provider
    _payback(_flashLoanAmount, activeProvider);

    // Withdraw collateral proportional ratio from current provider
    uint256 collateraltoMove = (IProvider(activeProvider).getDepositBalance(
      vAssets.collateralAsset
    ) * ratio) / 1e18;

    _withdraw(collateraltoMove, activeProvider);

    // Deposit to the new provider
    _deposit(collateraltoMove, _newProvider);

    // Borrow from the new provider, borrowBalance + premium
    _borrow(_flashLoanAmount + _fee, _newProvider);

    // return borrowed amount to Flasher
    IERC20(vAssets.borrowAsset).univTransfer(payable(msg.sender), _flashLoanAmount + _fee);

    emit Switch(address(this), activeProvider, _newProvider, _flashLoanAmount, collateraltoMove);
  }

  // Setter, change state functions

  /**
   * @dev Sets the fujiAdmin Address
   * @param _newFujiAdmin: FujiAdmin Contract Address
   */
  function setFujiAdmin(address _newFujiAdmin) external onlyOwner {
    _fujiAdmin = IFujiAdmin(_newFujiAdmin);
  }

  /**
   * @dev Sets a new active provider for the Vault
   * @param _provider: fuji address of the new provider
   * Emits a {SetActiveProvider} event.
   */
  function setActiveProvider(address _provider) external override isAuthorized {
    activeProvider = _provider;

    emit SetActiveProvider(_provider);
  }

  // Administrative functions

  /**
   * @dev Sets a fujiERC1155 Collateral and Debt Asset manager for this vault and initializes it.
   * @param _fujiERC1155: fuji ERC1155 address
   */
  function setFujiERC1155(address _fujiERC1155) external isAuthorized {
    fujiERC1155 = _fujiERC1155;

    vAssets.collateralID = IFujiERC1155(_fujiERC1155).addInitializeAsset(
      IFujiERC1155.AssetType.collateralToken,
      address(this)
    );
    vAssets.borrowID = IFujiERC1155(_fujiERC1155).addInitializeAsset(
      IFujiERC1155.AssetType.debtToken,
      address(this)
    );
  }

  /**
   * @dev Set Factors "a" and "b" for a Struct Factor
   * For safetyF;  Sets Safety Factor of Vault, should be > 1, a/b
   * For collatF; Sets Collateral Factor of Vault, should be > 1, a/b
   * @param _newFactorA: Nominator
   * @param _newFactorB: Denominator
   * @param _isSafety: safetyF or collatF
   */
  function setFactor(
    uint64 _newFactorA,
    uint64 _newFactorB,
    bool _isSafety
  ) external isAuthorized {
    if (_isSafety) {
      safetyF.a = _newFactorA;
      safetyF.b = _newFactorB;
    } else {
      collatF.a = _newFactorA;
      collatF.b = _newFactorB;
    }
  }

  /**
   * @dev Sets the Oracle address (Must Comply with AggregatorV3Interface)
   * @param _oracle: new Oracle address
   */
  function setOracle(address _oracle) external isAuthorized {
    oracle = IFujiOracle(_oracle);
  }

  /**
   * @dev Set providers to the Vault
   * @param _providers: new providers' addresses
   */
  function setProviders(address[] calldata _providers) external isAuthorized {
    providers = _providers;
  }

  /**
   * @dev External Function to call updateState in F1155
   */
  function updateF1155Balances() public override {
    uint256 borrowBals;
    uint256 depositBals;

    // take into account all balances across providers
    uint256 length = providers.length;
    for (uint256 i = 0; i < length; i++) {
      depositBals =
        depositBals +
        IProvider(providers[i]).getDepositBalance(vAssets.collateralAsset);
      borrowBals = borrowBals + (IProvider(providers[i]).getBorrowBalance(vAssets.borrowAsset));
    }

    IFujiERC1155(fujiERC1155).updateState(vAssets.borrowID, borrowBals);
    IFujiERC1155(fujiERC1155).updateState(vAssets.collateralID, depositBals);
  }

  //Getter Functions

  /**
   * @dev Returns an array of the Vault's providers
   */
  function getProviders() external view override returns (address[] memory) {
    return providers;
  }

  /**
   * @dev Returns an amount to be paid as bonus for liquidation
   * @param _amount: Vault underlying type intended to be liquidated
   * @param _flash: Flash or classic type of liquidation, bonus differs
   */
  function getLiquidationBonusFor(uint256 _amount, bool _flash)
    external
    view
    override
    returns (uint256)
  {
    if (_flash) {
      // Bonus Factors for Flash Liquidation
      (uint64 a, uint64 b) = _fujiAdmin.getBonusFlashL();
      return (_amount * (a)) / (b);
    } else {
      //Bonus Factors for Normal Liquidation
      (uint64 a, uint64 b) = _fujiAdmin.getBonusLiq();
      return (_amount * (a)) / (b);
    }
  }

  /**
   * @dev Returns the amount of collateral needed, including or not safety factors
   * @param _amount: Vault underlying type intended to be borrowed
   * @param _withFactors: Inidicate if computation should include safety_Factors
   */
  function getNeededCollateralFor(uint256 _amount, bool _withFactors)
    public
    view
    override
    returns (uint256)
  {
    // Get exchange rate
    uint256 price = oracle.getPriceOf(vAssets.collateralAsset, vAssets.borrowAsset, _BASE_DECIMAL);
    uint256 minimumReq = (_amount * (price)) / (10**_BASE_DECIMAL);

    if (_withFactors) {
      return (minimumReq * (collatF.a) * (safetyF.a)) / (collatF.b) / (safetyF.b);
    } else {
      return minimumReq;
    }
  }

  /**
   * @dev Returns the borrow balance of the Vault's underlying at a particular provider
   * @param _provider: address of a provider
   */
  function borrowBalance(address _provider) external view override returns (uint256) {
    return IProvider(_provider).getBorrowBalance(vAssets.borrowAsset);
  }

  /**
   * @dev Returns the deposit balance of the Vault's type collateral at a particular provider
   * @param _provider: address of a provider
   */
  function depositBalance(address _provider) external view override returns (uint256) {
    return IProvider(_provider).getDepositBalance(vAssets.collateralAsset);
  }

  /**
   * @dev Harvests the Rewards from baseLayer Protocols
   * @param _farmProtocolNum: number per VaultHarvester Contract for specific farm
   */
  function harvestRewards(uint256 _farmProtocolNum) external onlyOwner {
    address tokenReturned = IVaultHarvester(_fujiAdmin.getVaultHarvester()).collectRewards(
      _farmProtocolNum
    );
    uint256 tokenBal = IERC20(tokenReturned).balanceOf(address(this));
    require(tokenReturned != address(0) && tokenBal > 0, Errors.VL_HARVESTING_FAILED);
    IERC20(tokenReturned).univTransfer(payable(_fujiAdmin.getTreasury()), tokenBal);
  }
}
