// SPDX-License-Identifier: MIT
// FujiMapping for two addresses
pragma solidity ^0.8.0;

import "../abstracts/claimable/Claimable.sol";
import "../interfaces/IFujiKashiMapping.sol";

/**
 * @dev Contract that stores and returns addresses mappings
 * Required for getting contract addresses for kashi lending provider
 */

contract KashiMappingMATIC is IFujiKashiMapping, Claimable {
  mapping(address => mapping(address => address)) public override addressMapping; // (collateral, borrow) => kashi pair

  // URI that contains mapping information
  string public uri;

  /**
   * @dev Adds a two address Mapping
   */
  function setMapping(
    address _collateral,
    address _borrow,
    address _pair
  ) public onlyOwner {
    addressMapping[_collateral][_borrow] = _pair;
    emit MappingChanged(_collateral, _borrow, _pair);
  }

  /**
   * @dev Sets a new URI
   * Emits a {UriChanged} event.
   */
  function setURI(string memory newUri) public onlyOwner {
    uri = newUri;
    emit UriChanged(newUri);
  }
}
