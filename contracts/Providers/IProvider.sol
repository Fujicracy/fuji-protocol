
// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;

interface IProvider {

  //Basic Core Functions

  function deposit(address collateralAsset, uint256 collateralAmount) external payable;

  function borrow(address borrowAsset, uint256 borrowAmount) external payable;

  function withdraw(address collateralAsset, uint256 collateralAmount) external payable;

  function payback(address borrowAsset, uint256 borrowAmount) external payable;



  // returns the borrow annualized rate for an asset in ray (1e27)
  //Example 8.5% annual interest = 0.085 x 10^27 = 85000000000000000000000000 or 85*(10**24)
  function getBorrowRateFor(address asset) external view returns(uint256);
  function getBorrowBalance(address _asset) external view returns(uint256);
  function getDepositBalance(address _asset) external view returns(uint256);

}
