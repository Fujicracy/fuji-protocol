// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IGenIToken.sol";

interface IIErc20 is IGenIToken {
  function mint(address _recipient, uint256 _mintAmount) external;

  function mintForSelfAndEnterMarket(uint256 _mintAmount) external;

  function repayBorrow(uint256 _repayAmount) external;

  function repayBorrowBehalf(address _borrower, uint256 _repayAmount) external;
}
