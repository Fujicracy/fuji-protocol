// SPDX-License-Identifier: MIT
//FujiMapping for two addresses
pragma solidity ^0.8.0;

import "./abstracts/claimable/Claimable.sol";
import "./interfaces/IFujiMappings.sol";

/**
 * @dev Contract that stores and returns addresses mappings
 * Required for getting contract addresses for some providers and flashloan providers
 */

contract FujiMapping is IFujiMappings, Claimable {
  // Address 1 =>  Address 2 (e.g. erc20 => cToken, contract a L1 => contract b L2, etc)
  mapping(address => address) public override addressMapping;

  // URI that contains mapping information
  string public uri;

  /**
   * @dev Adds a two address Mapping
   * @param _addr1: key address for mapping (erc20, provider)
   * @param _addr2: result address (cToken, erc20)
   */
  function setMapping(address _addr1, address _addr2) public onlyOwner {
    addressMapping[_addr1] = _addr2;
    emit MappingChanged(_addr1, _addr2);
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
