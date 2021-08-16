// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";

import "./FujiBaseERC1155.sol";
import "../Claimable/ClaimableUpgradeable.sol";
import "../../Interfaces/IFujiERC1155.sol";
import "../../Libraries/WadRayMath.sol";
import "../../Libraries/Errors.sol";

abstract contract F1155Manager is ClaimableUpgradeable {
  using Address for address;

  // Controls for Mint-Burn Operations
  mapping(address => bool) public addrPermit;

  modifier onlyPermit() {
    require(addrPermit[_msgSender()] || msg.sender == owner(), Errors.VL_NOT_AUTHORIZED);
    _;
  }

  function setPermit(address _address, bool _permit) public onlyOwner {
    require((_address).isContract(), Errors.VL_NOT_A_CONTRACT);
    addrPermit[_address] = _permit;
  }
}
