// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Claimable is Ownable {
    address public pendingOwner;

    event NewPendingOwner(address indexed owner);

    modifier onlyPendingOwner() {
        require(_msgSender() == pendingOwner);
        _;
    }

    function transferOwnership(address newOwner) public override onlyOwner {
        require(pendingOwner == address(0));
        pendingOwner = newOwner;
        emit NewPendingOwner(newOwner);
    }

    function cancelTransferOwnership() public onlyOwner {
        require(pendingOwner != address(0));
        delete pendingOwner;
        emit NewPendingOwner(address(0));
    }

    function claimOwnership() public onlyPendingOwner {
        super.transferOwnership(msg.sender);
        delete pendingOwner;
    }
}