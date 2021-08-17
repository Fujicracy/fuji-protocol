// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IVaultHarvester {
  function collectRewards(uint256 _farmProtocolNum) external returns (address claimedToken);
}
