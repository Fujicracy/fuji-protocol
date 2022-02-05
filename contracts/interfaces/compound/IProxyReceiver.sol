// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IGenCToken.sol";

interface IProxyReceiver {
  function withdraw(uint256, IGenCToken) external payable;
}
