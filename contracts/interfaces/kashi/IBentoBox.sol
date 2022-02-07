// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

interface IBentoBox {
  function deposit(
    address token_,
    address from,
    address to,
    uint256 amount,
    uint256 share
  ) external payable returns (uint256 amountOut, uint256 shareOut);

  function flashLoan(
    address borrower,
    address receiver,
    address token,
    uint256 amount,
    bytes calldata data
  ) external;

  function harvest(
    address token,
    bool balance,
    uint256 maxChangeAmount
  ) external;

  function toAmount(
    address token,
    uint256 share,
    bool roundUp
  ) external view returns (uint256 amount);

  function toShare(
    address token,
    uint256 amount,
    bool roundUp
  ) external view returns (uint256 share);

  function balanceOf(
    address token,
    address user
  ) external view returns (uint256 amount);

  function transfer(
    address token,
    address from,
    address to,
    uint256 share
  ) external;

  function withdraw(
    address token_,
    address from,
    address to,
    uint256 amount,
    uint256 share
  ) external returns (uint256 amountOut, uint256 shareOut);
}
