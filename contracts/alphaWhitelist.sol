// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.8.0;

import { ReentrancyGuard } from "./@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Errors} from './Debt-token/Errors.sol';

contract alphaWhitelist is ReentrancyGuard  {

  uint256 public ETH_CAP_VALUE = 10**18;
  uint256 public LIMIT_USERS = 100;
  uint256 private counter = 1;
  uint256 public timeblock;

  mapping(uint256 => address) public whitelisted;
  mapping(address => uint256) public reversedwhitelisted;

  // Log Users entered
	event userWhitelisted(address _userAddrs, uint256 _counter, uint256 _blocknumber);

  constructor() public {
    timeblock = block.number;
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
    require(block.number > timeblock + 50, Errors.SP_ALPHA_WAIT_BLOCKLAG);

    whitelisted[counter] = msg.sender;
    reversedwhitelisted[msg.sender] = counter;

    counter += 1;

    timeblock = block.number;

    emit userWhitelisted(msg.sender, counter, block.number);
  }

}
