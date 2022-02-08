// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/compound/IGenCToken.sol";

contract ProxyReceiver {

  receive() external payable {}

  /**
   * @notice Withdraw FTM and transfer to msg.sender
   * @dev msg.sender needs to transfer before calling this withdraw
   * @param _amount amount to withdraw.
   * @param _cToken cToken to interact with.
   */
  function withdraw(uint256 _amount, IGenCToken _cToken) external {
    require(_cToken.redeemUnderlying(_amount) == 0, "Withdraw-failed");

    (bool sent, ) = msg.sender.call{ value: _amount }("");
    require(sent, "Failed to send FTM");
  }
}
