// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../libraries/FlashLoans.sol";

interface IFlasher {
  /**
   * @dev Logs a change in FujiAdmin address.
   */
  event FujiAdminChanged(address newFujiAdmin);

  function initiateFlashloan(FlashLoan.Info calldata info, uint8 amount) external;
}
