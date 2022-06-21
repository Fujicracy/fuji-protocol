// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface INFTGame {

  function getPhase() external view returns (uint256);

  function gamePhaseTimestamps(uint256) external view returns(uint256);

  function isValidVault(address) external view returns(bool);

  function checkStateOfPoints(
    address user,
    uint256 balanceChange,
    bool isPayback,
    uint256 decimals
  ) external;

}