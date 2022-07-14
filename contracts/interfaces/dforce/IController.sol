// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IController {
  function enterMarkets(address[] calldata iTokens)
        external
        returns (bool[] memory);

  function exitMarkets(address[] calldata iTokens)
        external
        returns (bool[] memory);
}
