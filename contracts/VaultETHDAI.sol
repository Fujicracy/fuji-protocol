// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;
//pragma experimental ABIEncoderV2;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "./LibUniERC20.sol";
import "./IProvider.sol";

// DEBUG
import "hardhat/console.sol";

contract VaultETHDAI {
  using SafeMath for uint256;
  using UniERC20 for IERC20;

  AggregatorV3Interface public oracle;

  struct Position {
    uint256 collateralAmount;
    uint256 borrowAmount;
  }

  struct Factor {
    uint256 a;
    uint256 b;
  }
  //  a divided by b represent Safety factor, example 1.2, or +20%, is (a/b)= 6/5
  Factor public safetyF;
  //  a divided by b represent collateralization factor
  Factor public collatF;
  uint256 internal constant BASE = 1e18;

  address public controller;

  IProvider[] public providers;
  IProvider public activeProvider;

  address public constant collateralAsset = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE); // ETH
  address public constant borrowAsset = address(0x6B175474E89094C44Da98b954EedeAC495271d0F); // DAI

  mapping(address => Position) public positions;

  // balance of all available collateral in ETH
  uint256 public collateralBalance;

  // balance of outstanding DAI
  uint256 public outstandingBalance;

  modifier isAuthorized() {
    require(msg.sender == controller || msg.sender == address(this), "!authorized");
    _;
  }

  constructor(
    address _controller,
    address _oracle,
    address _provider
  ) public {
    oracle = AggregatorV3Interface(_oracle);
    controller = _controller;

    // + 5%
    safetyF.a = 21;
    safetyF.b = 20;

    // 125%
    collatF.a = 5;
    collatF.b = 4;

    // TODO remove
    activeProvider = IProvider(_provider);
  }

  function depositAndBorrow(uint256 _collateralAmount, uint256 _borrowAmount) external payable {
    deposit(_collateralAmount);
    borrow(_borrowAmount);
  }

  function deposit(uint256 _collateralAmount) public payable {
    // TODO
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

    Position storage position = positions[msg.sender];
    position.collateralAmount = position.collateralAmount.add(_collateralAmount);
  }

  function withdraw(uint256 _withdrawAmount) public {
    // TODO
    Position storage position = positions[msg.sender];

    require(
      position.collateralAmount >= _withdrawAmount,
      "Withdrawal amount exceeds provided amount"
    );
    // get needed collateral for current position
    // according current price
    uint256 neededCollateral = getNeededCollateralFor(
      position.borrowAmount
    );

    require(
      position.collateralAmount.sub(_withdrawAmount) >= neededCollateral,
      "Not enough collateral left"
    );

    bytes memory data = abi.encodeWithSignature(
      "withdraw(address,uint256)",
      collateralAsset,
      _withdrawAmount
    );
    execute(address(activeProvider), data);

    position.collateralAmount = position.collateralAmount.sub(_withdrawAmount);
    IERC20(collateralAsset).uniTransfer(msg.sender, _withdrawAmount);
    collateralBalance = collateralBalance.sub(_withdrawAmount);
  }

  function borrow(uint256 _borrowAmount) public {
    // TODO
    Position storage position = positions[msg.sender];

    // get needed collateral for already existing positions
    // together with the new position
    // according current price
    uint256 neededCollateral = getNeededCollateralFor(
      _borrowAmount.add(position.borrowAmount)
    );

    require(position.collateralAmount > neededCollateral, "Not enough collateral provided");

    bytes memory data = abi.encodeWithSignature(
      "borrow(address,uint256)",
      borrowAsset,
      _borrowAmount
    );
    execute(address(activeProvider), data);

    outstandingBalance = outstandingBalance.add(_borrowAmount);
    position.borrowAmount = position.borrowAmount.add(_borrowAmount);
    IERC20(borrowAsset).uniTransfer(msg.sender, _borrowAmount);
  }

  function payback(uint256 _repayAmount) public payable {
    // TODO
    Position storage position = positions[msg.sender];

    require(
      IERC20(borrowAsset).allowance(msg.sender, address(this)) >= _repayAmount,
      "Not enough allowance"
    );

    outstandingBalance = outstandingBalance.sub(_repayAmount);
    position.borrowAmount = position.borrowAmount.sub(_repayAmount);
    IERC20(borrowAsset).transferFrom(msg.sender, address(this), _repayAmount);
  }

  function paybackAll() public payable {

  }

  function addProvider(address _provider) external isAuthorized {
    IProvider provider = IProvider(_provider);

    // TODO check if it's already added
    providers.push(provider);

    if (providers.length == 1) {
      activeProvider = provider;
    }
  }

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

  function getCollateralShareOf(address _user) public view returns(uint256 share) {
    uint256 providedCollateral = positions[_user].collateralAmount;
    if (providedCollateral == 0) {
      share = 0;
    }
    else {
      share = providedCollateral.mul(BASE).div(collateralBalance);
    }
  }


  function getRedeemableAmountOf(address _user) public view returns(uint256 share) {
    uint256 collateralShare = getCollateralShareOf(_user);
    share = redeemableCollateralBalance().mul(collateralShare).div(BASE);
  }

  function setActiveProvider(address _provider) external isAuthorized {
    activeProvider = IProvider(_provider);
  }

  function redeemableCollateralBalance() public view returns(uint256) {
    return IERC20(0x030bA81f1c18d280636F32af80b9AAd02Cf0854e).balanceOf(address(this)); // AAVE aWETH
    //return IERC20(0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5).balanceOf(address(this)); // Compound cETH
  }

  function balanceOfBorrow() external view returns(uint256) {
    return IERC20(borrowAsset).balanceOf(address(this));
  }

  function checkCollateralPosition(address addr) external view returns(uint256) {
    return positions[addr].collateralAmount;
  }

  function checkBorrowPosition(address addr) external view returns(uint256) {
    return positions[addr].borrowAmount;
  }

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
