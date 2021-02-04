// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import { WadRayMath } from "./aave-debt-token/WadRayMath.sol";
import { VariableDebtToken } from "./aave-debt-token/VariableDebtToken.sol";
import "./LibUniERC20.sol";
import "./IProvider.sol";

interface IVault {
  function activeProvider() external view returns(address);
  function borrowAsset() external view returns(address);
  function borrowBalance() external returns(uint256);
  function collateralAsset() external view returns(address);
  function fujiSwitch(address _newProvider, uint256 _flashLoanDebt) external payable;
  function getProviders() external view returns(address[] memory);
  function setActiveProvider(address _provider) external;
}

contract VaultETHDAI is IVault {

  using SafeMath for uint256;
  using WadRayMath for uint256;
  using UniERC20 for IERC20;

  AggregatorV3Interface public oracle;


  //Base Struct Object to define Safety factor
  //a divided by b represent the factor example 1.2, or +20%, is (a/b)= 6/5
  struct Factor {
    uint256 a;
    uint256 b;
  }

  //Safety factor
  Factor public safetyF;

  //Collateralization factor
  Factor public collatF;
  uint256 internal constant BASE = 1e18;

  address public controller;
  address private owner;

  //State variables to control vault providers
  address[] public providers;
  address public override activeProvider;

  //Managed assets in this Vault
  address public override collateralAsset = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE); // ETH
  address public override borrowAsset = address(0x6B175474E89094C44Da98b954EedeAC495271d0F); // DAI

  VariableDebtToken debtToken;

  	// Log Users deposit
	event Deposit(address userAddrs,uint256 amount);
	// Log Users borrow
	event Borrow(address userAddrs,uint256 amount);
	// Log Users debt repay
	event Repay(address userAddrs,uint256 amount);
	// Log Users withdraw
	event Withdraw(address userAddrs,uint256 amount);
	// Log New active provider
	event SetActiveProvider(address providerAddrs);
	// Log Switch providers
	event Switch(address fromProviderAddrs,address toProviderAddrs);


  mapping(address => uint256) public collaterals;

  //Balance of all available collateral in ETH
  uint256 public collateralBalance;

  modifier isAuthorized() {
    require(msg.sender == controller || msg.sender == address(this) || msg.sender == owner, "!authorized");
    _;
  }

  constructor(
    address _controller,
    address _oracle,
    address _owner
  ) public {

    controller = _controller;
    oracle = AggregatorV3Interface(_oracle);
    owner = _owner;

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
  * @param _collateralAmount to be deposited, and _borrowAmount of underlying
  */
  function depositAndBorrow(uint256 _collateralAmount, uint256 _borrowAmount) external payable {
    deposit(_collateralAmount);
    borrow(_borrowAmount);
  }

  /**
  * @dev Deposit Vault's type collateral to activeProvider
  * @param _collateralAmount: to be deposited
  */
  function deposit(uint256 _collateralAmount) public payable {
    require(msg.value == _collateralAmount, "Collateral amount not the same as sent amount");

    uint256 currentBalance = redeemableCollateralBalance();

    bytes memory data = abi.encodeWithSignature(
      "deposit(address,uint256)",
      collateralAsset,
      _collateralAmount
    );
    execute(address(activeProvider), data);

    uint256 newBalance = redeemableCollateralBalance();

    require(newBalance > currentBalance, "Not enough collateral been received");

    collateralBalance = collateralBalance.add(_collateralAmount);

    uint256 providedCollateral = collaterals[msg.sender];
    collaterals[msg.sender] = providedCollateral.add(_collateralAmount);

    emit Deposit(msg.sender, _collateralAmount);
  }

  /**
  * @dev Withdraws Vault's type collateral from activeProvider
  * @param _withdrawAmount: amount of collateral to withdraw
  */
  function withdraw(uint256 _withdrawAmount) public {

    uint256 providedCollateral = collaterals[msg.sender];

    require(
      providedCollateral >= _withdrawAmount,
      "Withdrawal amount exceeds provided amount"
    );
    // get needed collateral for current position
    // according current price
    uint256 neededCollateral = getNeededCollateralFor(
      debtToken.balanceOf(msg.sender)
    );

    require(
      providedCollateral.sub(_withdrawAmount) >= neededCollateral,
      "Not enough collateral left"
    );

    bytes memory data = abi.encodeWithSignature(
      "withdraw(address,uint256)",
      collateralAsset,
      _withdrawAmount
    );
    execute(address(activeProvider), data);

    collaterals[msg.sender] = providedCollateral.sub(_withdrawAmount);
    IERC20(collateralAsset).uniTransfer(msg.sender, _withdrawAmount);
    collateralBalance = collateralBalance.sub(_withdrawAmount);

    emit Withdraw(msg.sender, _withdrawAmount);
  }

  /**
  * @dev Borrows Vault's type underlying amount from activeProvider
  * @param _borrowAmount: token amount of underlying to borrow
  */
  function borrow(uint256 _borrowAmount) public {

    uint256 providedCollateral = collaterals[msg.sender];

    // get needed collateral for already existing positions
    // together with the new position
    // according current price
    uint256 neededCollateral = getNeededCollateralFor(
      _borrowAmount.add(debtToken.balanceOf(msg.sender))
    );

    require(providedCollateral > neededCollateral, "Not enough collateral provided");

    if (debtToken.totalSupply() > 0 && borrowBalance() > 0) {
      debtToken.updateState(
        borrowBalance().sub(debtToken.totalSupply())
      );
    }

    bytes memory data = abi.encodeWithSignature(
      "borrow(address,uint256)",
      borrowAsset,
      _borrowAmount
    );
    execute(address(activeProvider), data);

    IERC20(borrowAsset).uniTransfer(msg.sender, _borrowAmount);

    debtToken.mint(
      msg.sender,
      msg.sender,
      _borrowAmount
    );

    emit Borrow(msg.sender, _borrowAmount);
  }

  /**
  * @dev Paybacks Vault's type underlying to activeProvider
  * @param _repayAmount: token amount of underlying to repay
  */
  function payback(uint256 _repayAmount) public payable {
    // TODO
    uint256 providedCollateral = collaterals[msg.sender];

    require(
      IERC20(borrowAsset).allowance(msg.sender, address(this)) >= _repayAmount,
      "Not enough allowance"
    );

    debtToken.updateState(
      borrowBalance().sub(debtToken.totalSupply())
    );

    IERC20(borrowAsset).transferFrom(msg.sender, address(this), _repayAmount);

    bytes memory data = abi.encodeWithSignature(
      "payback(address,uint256)",
      borrowAsset,
      _repayAmount
    );
    execute(address(activeProvider), data);

    debtToken.burn(
      msg.sender,
      _repayAmount
    );

    emit Repay(msg.sender, _repayAmount);
  }

  /**
  * @dev Changes Vault debt and collateral to a newProvider, called by Controller
  * @param _newProvider new provider fuji address
  * @param _flashLoanDebt amount of flashloan underlying to repay Flashloan
  */
  function fujiSwitch(address _newProvider, uint256 _flashLoanDebt) public override payable {
    uint256 borrowBalance = borrowBalance();

    require(
      IERC20(borrowAsset).allowance(msg.sender, address(this)) >= borrowBalance,
      "Not enough allowance"
    );

    IERC20(borrowAsset).transferFrom(msg.sender, address(this), borrowBalance);

    // payback current provider
    bytes memory data = abi.encodeWithSignature(
      "payback(address,uint256)",
      borrowAsset,
      borrowBalance
    );
    execute(address(activeProvider), data);

    // withdraw collateral from current provider
    data = abi.encodeWithSignature(
      "withdraw(address,uint256)",
      collateralAsset,
      collateralBalance
    );
    execute(address(activeProvider), data);

    // deposit to the new provider
    data = abi.encodeWithSignature(
      "deposit(address,uint256)",
      collateralAsset,
      collateralBalance
    );
    execute(address(_newProvider), data);

    // borrow from the new provider, borrowBalance + premium = flashloandebt
    data = abi.encodeWithSignature(
      "borrow(address,uint256)",
      borrowAsset,
      _flashLoanDebt
    );
    execute(address(_newProvider), data);

    debtToken.updateState(
      _flashLoanDebt.sub(debtToken.totalSupply())
    );

    // return borrowed amount to Flasher
    IERC20(borrowAsset).uniTransfer(msg.sender, _flashLoanDebt);

    emit Switch(activeProvider, _newProvider);
  }

  //Administrative functions

  /**
  * @dev Sets the debtToken address to the Vault
  * @param _debtToken: fuji debt token address
  */
  function setDebtToken(address _debtToken) external {
    debtToken = VariableDebtToken(_debtToken);
  }

  /**
  * @dev Adds a provider to the Vault
  * @param _provider: new provider fuji address
  */
  function addProvider(address _provider) external isAuthorized {
    bool alreadyincluded = false;

    //Check if Provider is not already included
    for(uint i =0; i < providers.length; i++ ){
      if(providers[i] == _provider){
        alreadyincluded = true;
      }
    }
    require(alreadyincluded== false, "Provider is already included in Vault");

    //Push new provider to provider array
    providers.push(_provider);

    //Asign an active provider if none existed
    if (providers.length == 1) {
      activeProvider = _provider;
    }
  }

  /**
  * @dev Returns the amount of collateral needed, including safety factors
  * @param _amount: Vault underlying type intended to be borrowed
  */
  function getNeededCollateralFor(uint256 _amount) public view returns(uint256) {
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
  * @dev Returns the redeermable amount of collateral of a user address
  * @param _user: address of the user
  */
  function getRedeemableAmountOf(address _user) public view returns(uint256 share) {
    uint256 collateralShare = getCollateralShareOf(_user);
    share = redeemableCollateralBalance().mul(collateralShare).div(BASE);
  }

  /**
  * @dev Sets a new active provider for the Vault
  * @param _provider: fuji address of the new provider
  */
  function setActiveProvider(address _provider) external override isAuthorized {
    activeProvider = _provider;

    emit SetActiveProvider(_provider);
  }

  /**
  * @dev Returns the amount of redeemable collateral from an active provider
  */
  function redeemableCollateralBalance() public view returns(uint256) {
    address redeemable = IProvider(activeProvider).getRedeemableAddress(collateralAsset);
    return IERC20(redeemable).balanceOf(address(this));
    //return IERC20(0x030bA81f1c18d280636F32af80b9AAd02Cf0854e).balanceOf(address(this)); // AAVE aWETH
    //return IERC20(0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5).balanceOf(address(this)); // Compound cETH
  }

  /**
  * @dev Returns the total borrow balance of the Vault's type underlying at active provider
  */
  function borrowBalance() public override returns(uint256) {
    return IProvider(activeProvider).getBorrowBalance(borrowAsset);
  }

  /**
  * @dev Returns an array of the Vault's providers
  */
  function getProviders() external view override returns(address[] memory) {
    return providers;
  }

  //Internal functions

  /**
  * @dev Returns byte response of delegatcalls
  */
  function execute(
    address _target,
    bytes memory _data
  ) internal returns (bytes memory response) {
    assembly {
      let succeeded := delegatecall(sub(gas(), 5000), _target, add(_data, 0x20), mload(_data), 0, 0)
      let size := returndatasize()

      response := mload(0x40)
      mstore(0x40, add(response, and(add(add(size, 0x20), 0x1f), not(0x1f))))
      mstore(response, size)
      returndatacopy(add(response, 0x20), 0, size)

      switch iszero(succeeded)
      case 1 {
        // throw if delegatecall failed
        revert(add(response, 0x20), size)
      }
    }
  }

  receive() external payable {}
}
