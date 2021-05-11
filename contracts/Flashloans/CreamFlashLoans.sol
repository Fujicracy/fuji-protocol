// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.5;

interface ICFlashloanReceiver {
  function executeOperation(
    address sender,
    address underlying,
    uint256 amount,
    uint256 fee,
    bytes calldata params
  ) external;
}

interface ICTokenFlashloan {
  function flashLoan(
    address receiver,
    uint256 amount,
    bytes calldata params
  ) external;
}
