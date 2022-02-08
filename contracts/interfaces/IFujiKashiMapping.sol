// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IFujiKashiMapping {
  // FujiMapping Events

  /**
   * @dev Log a change in address mapping
   */
  event MappingChanged(address collateral, address borrow, address kashiPair);
  /**
   * @dev Log a change in URI
   */
  event UriChanged(string newUri);

  function addressMapping(address, address) external view returns (address);
}
