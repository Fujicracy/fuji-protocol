// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./FujiBaseERC1155.sol";
import "../claimable/ClaimableUpgradeable.sol";
import "../../interfaces/IFujiERC1155.sol";
import "../../libraries/WadRayMath.sol";
import "../../libraries/Errors.sol";

/**
 * @dev Contract that controls permissions to mint and burn in {FujiERC1155}
 *
 */

abstract contract F1155Manager is ClaimableUpgradeable {
  using AddressUpgradeable for address;

  // F1155 Events

  /**
   * @dev Log a change in address mint-burn permission
   */
  event PermitChanged(address vaultAddress, bool newPermit);

  // Controls for Mint-Burn Operations
  mapping(address => bool) public addrPermit;

  /**
   * @dev Throws if called by an account that is not permitted to mint and burn.
   */
  modifier onlyPermit() {
    require(addrPermit[_msgSender()] || msg.sender == owner(), Errors.VL_NOT_AUTHORIZED);
    _;
  }

  /**
   * @dev Sets permit to '_address' for mint and burn operations.
   * Can only be called by the contract owner.
   * Emits a {PermitChanged} event.
   */
  function setPermit(address _address, bool _permit) public onlyOwner {
    require((_address).isContract(), Errors.VL_NOT_A_CONTRACT);
    addrPermit[_address] = _permit;
    emit PermitChanged(_address, _permit);
  }
}
