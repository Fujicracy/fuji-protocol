// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.5;

interface ICFlashloanReceiver {
    function executeOperation(
      address sender,
      address underlying,
      uint amount,
      uint fee,
      bytes calldata params
    ) external;
}

interface ICTokenFlashloan {
    function flashLoan(
      address receiver,
      uint amount,
      bytes calldata params
    ) external;
}
