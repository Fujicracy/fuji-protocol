// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { UniERC20 } from "../Libraries/LibUniERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IProvider } from "./IProvider.sol";

interface LQTYInterface {}

contract LQTYHelpers {
  function _initializeTrouve() internal {
    //TODO function
  }
}

contract ProviderLQTY is IProvider, LQTYHelpers {
  using SafeMath for uint256;
  using UniERC20 for IERC20;

  function deposit(address collateralAsset, uint256 collateralAmount) external payable override {
    collateralAsset;
    collateralAmount;
    //TODO
  }

  function borrow(address borrowAsset, uint256 borrowAmount) external payable override {
    borrowAsset;
    borrowAmount;
    //TODO
  }

  function withdraw(address collateralAsset, uint256 collateralAmount) external payable override {
    collateralAsset;
    collateralAmount;
    //TODO
  }

  function payback(address borrowAsset, uint256 borrowAmount) external payable override {
    borrowAsset;
    borrowAmount;
    //TODO
  }

  function getBorrowRateFor(address asset) external view override returns (uint256) {
    asset;
    //TODO
    return 0;
  }

  function getBorrowBalance(address _asset) external view override returns (uint256) {
    _asset;
    //TODO
    return 0;
  }

  function getBorrowBalanceOf(address _asset, address _who) external override returns (uint256) {
    _asset;
    _who;
    //TODO
    return 0;
  }

  function getDepositBalance(address _asset) external view override returns (uint256) {
    _asset;
    //TODO
    return 0;
  }
}
