
// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;

interface IProvider {

function deposit(address collateralAsset, uint256 collateralAmount) external virtual ;
function borrow(address borrowAsset, uint256 borrowAmount) external virtual ;
function withdraw(address collateralAsset, uint256 collateralAmount) external virtual ;
function payback(address borrowAsset, uint256 borrowAmount) external virtual ;

}
