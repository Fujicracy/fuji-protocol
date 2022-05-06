// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVoucherSVG {
  function generateSVG(address voucher_, uint256 tokenId_) external view returns (string memory);
}
