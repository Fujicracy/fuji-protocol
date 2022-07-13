// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IGenIToken is IERC20 {
  function redeem(address from, uint256 redeemTokens) external;

  function redeemUnderlying(address _from, uint256 _redeemUnderlying) external;

  function borrow(uint256 _borrowAmount) external;

  function exchangeRateCurrent() external returns (uint256);

  function exchangeRateStored() external view returns (uint256);

  function borrowRatePerBlock() external view returns (uint256);

  function supplyRatePerBlock() external view returns (uint256);

  function balanceOfUnderlying(address _account) external returns (uint256);

  function borrowBalanceCurrent(address _user) external returns (uint256);

  function borrowBalanceStored(address _user) external view returns (uint256);
}
