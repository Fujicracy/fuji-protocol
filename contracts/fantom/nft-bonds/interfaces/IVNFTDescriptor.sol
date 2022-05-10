// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVNFTDescriptor {
  /**
   * @dev NFTGame contract address changed
   */
  event NFTGameChanged(address newAddress);
  /**
   * @dev VoucherSVG contract address changed
   */
  event SlotDetailChanges(uint _slotID, string _desc);
  /**
   * @dev VoucherSVG contract address changed
   */
  event SetVoucherSVG(address indexed voucher, address oldVoucherSVG, address newVoucherSVG);

  function contractURI() external view returns (string memory);

  function slotURI(uint256 slot) external view returns (string memory);

  function tokenURI(uint256 tokenId) external view returns (string memory);
}
