// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IGenCToken.sol";

interface IIEth is IGenCToken {
  function mint(address _recipient) external payable;

  function mintForSelfAndEnterMarket() external payable;

  function repayBorrow() external payable;

  function repayBorrowBehalf(address _borrower) external payable;
}
