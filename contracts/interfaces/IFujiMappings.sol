// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IFujiMappings {
  // FujiMapping Events

  /**
   * @dev Log a change in address mapping
   */
  event MappingChanged(address keyAddress, address mappedAddress);
  /**
   * @dev Log a change in URI
   */
  event UriChanged(string newUri);

  function addressMapping(address) external view returns (address);
}
