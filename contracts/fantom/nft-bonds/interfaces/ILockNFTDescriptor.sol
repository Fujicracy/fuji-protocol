// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ILockNFTDescriptor {
  /**
   * @dev NFTGame contract address changed
   */
  event NFTGameChanged(address newAddress);
  /**
   * @dev LockNFTSVG contract address changed
   */
  event SetLockNFTSVG(address newLockNFTSVG);

  function lockNFTUri(uint256 tokenId) external view returns (string memory);
}
