// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;
//pragma experimental ABIEncoderV2;

import "./LibUniERC20.sol";
import "./IProvider.sol";

import "hardhat/console.sol";

contract VaultETHDAI {
  using SafeMath for uint256;
  using UniERC20 for IERC20;

  struct Position {
    uint256 collateralAmount;
    uint256 borrowAmount;
  }

  address public controller;

  IProvider[] public providers;
  IProvider public activeProvider;

  address public constant collateralAsset = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE); // ETH
  address public constant borrowAsset = address(0x6B175474E89094C44Da98b954EedeAC495271d0F); // DAI

  mapping(address => Position) public positions;

  modifier isAuthorized() {
    require(msg.sender == controller || msg.sender == address(this), "!authorized");
    _;
  }

  constructor(
    address _controller,
    address _provider
  ) public {
    controller = _controller;
    activeProvider = IProvider(_provider);
  }

  function borrow(uint256 borrowAmount, uint256 collateralAmount) external payable {
    // TODO
    bytes memory data = abi.encodeWithSignature("borrow(address,uint256)", borrowAsset, borrowAmount);
    execute(address(activeProvider), data);

    // direct call
    //activeProvider.borrow(borrowAsset, borrowAmount, msg.sender);
    // delegatecall
    //(bool success, bytes memory result) = address(activeProvider).delegatecall(
      //abi.encodeWithSignature("borrow(address,uint256)", borrowAsset, borrowAmount)
    //);
    //console.log(success);
  }

  function deposit(uint256 collateralAmount) external payable {
    // TODO
    bytes memory data = abi.encodeWithSignature("deposit(address,uint256)", collateralAsset, collateralAmount);
    execute(address(activeProvider), data);

    // direct call
    //activeProvider.deposit{ value: msg.value }(collateralAsset, collateralAmount);
    // delegatecall
    //(bool success, bytes memory result) = address(activeProvider).delegatecall(
      //abi.encodeWithSignature("deposit(address,uint256)", collateralAsset, collateralAmount)
    //);
    //console.log(success);
  }

  function addProvider(address _provider) external isAuthorized {
    IProvider provider = IProvider(_provider);

    // TODO check if it's already added
    providers.push(provider);

    if (providers.length == 1) {
      activeProvider = provider;
    }
  }

  function setActiveProvider(address _provider) external isAuthorized {
    activeProvider = IProvider(_provider);
  }

  function balanceOfCollateral() external view returns(uint256) {
    return IERC20(0x030bA81f1c18d280636F32af80b9AAd02Cf0854e).balanceOf(address(this));
  }

  function balanceOfWETH() external view returns(uint256) {
    return IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).balanceOf(address(this));
  }

  function balanceOfBorrow() external view returns(uint256) {
    return IERC20(borrowAsset).balanceOf(address(this));
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
}
