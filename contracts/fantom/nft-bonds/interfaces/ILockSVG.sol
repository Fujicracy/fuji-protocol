// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ILockSVG {
  function generateSVG(uint256 tokenId_) external view returns (string memory);
}