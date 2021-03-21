// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.8.0;

import { ReentrancyGuard } from "./@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Errors} from './Debt-token/Errors.sol';

contract AlphaWhitelist is ReentrancyGuard  {

  uint256 public ETH_CAP_VALUE = 10**18;
  uint256 public LIMIT_USERS;
  uint256 private counter = 1;

  mapping(uint256 => address) public whitelisted;
  mapping(address => uint256) public reversedwhitelisted;

  // Log Users entered
	event userWhitelisted(address _userAddrs, uint256 _counter);

  constructor() public {
  }

  /**
 * @dev Throws if called by any account that is not Whitelisted.
 */
  modifier isWhitelisted(){
    require(reversedwhitelisted[msg.sender] != 0, Errors.SP_ALPHA_ADDR_NOT_WHTLIST);
    _;
  }


  /**
  * @dev Adds a user's address to the Fuji Whitelist
  * Emits a {userWhitelisted} event.
  */
  function addmetowhitelist() public nonReentrant {

    require(reversedwhitelisted[msg.sender] == 0, Errors.SP_ALPHA_ADDR_OK_WHTLIST);
    require(counter <= LIMIT_USERS, Errors.SP_ALPHA_WHTLIST_FULL);

    whitelisted[counter] = msg.sender;
    reversedwhitelisted[msg.sender] = counter;

    counter += 1;

    emit userWhitelisted(msg.sender, counter);
  }

}
