// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IPoolAddressProvider {
  function getPoolDataProvider() external view returns (address);
}