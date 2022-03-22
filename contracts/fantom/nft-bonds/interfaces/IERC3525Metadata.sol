// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ERC3525Metadata /* is IERC721Metadata */ {
    function contractURI() external view returns (string memory);

    function slotURI(uint256 slot_) external view returns (string memory);
}