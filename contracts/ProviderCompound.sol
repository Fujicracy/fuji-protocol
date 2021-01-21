// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;

import "./LibUniERC20.sol";
import "./IProvider.sol";

contract ProviderCompound is IProvider {
  using SafeMath for uint256;
  using UniERC20 for IERC20;

  function deposit(
    address collateralAsset,
    uint256 collateralAmount
  ) external override payable {
    // TODO
  }

  function borrow(
    address borrowAsset,
    uint256 borrowAmount
  ) external override payable {
    // TODO
  }
}
