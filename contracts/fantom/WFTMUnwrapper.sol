// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IWETH.sol";

contract WFTMUnwrapper {
  address constant wftm = 0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83;

  receive() external payable {}

  /**
   * @notice Convert WFTM to FTM and transfer to msg.sender
   * @dev msg.sender needs to send WFTM before calling this withdraw
   * @param _amount amount to withdraw.
   */
  function withdraw(uint256 _amount) external {
    IWETH(wftm).withdraw(_amount);
    (bool sent, ) = msg.sender.call{ value: _amount }("");
    require(sent, "Failed to send FTM");
  }
}
