// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVNFTDescriptor {

    function contractURI() external view returns (string memory);
    function slotURI(uint256 slot) external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);

}