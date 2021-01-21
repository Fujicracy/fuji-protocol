// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;

interface IProvider {
  // TODO

  function deposit(address collateralAsset, uint256 collateralAmount) external virtual payable;
  function borrow(address borrowAsset, uint256 borrowAmount) external virtual payable;
}
