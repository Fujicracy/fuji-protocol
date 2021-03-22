// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.8.0;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Errors} from './Debt-token/Errors.sol';

contract AlphaWhitelist is ReentrancyGuard  {

  uint256 public ETH_CAP_VALUE;
  uint256 public LIMIT_USERS;
  uint256 private counter = 1;
  uint256 public timeblock;

  mapping(address => uint256) public whitelisted;

  // Log Users entered
	event userWhitelisted(address _userAddrs, uint256 _counter);

  constructor(

    uint256 _limitusers,
    uint256 _capvalue,
    address[] memory confirmedUsrAddrs,
    address _fliquidator

  ) public {

    LIMIT_USERS = _limitusers;
    ETH_CAP_VALUE = _capvalue;

    require(confirmedUsrAddrs.length < LIMIT_USERS, Errors.SP_ALPHA_WHTLIST_FULL);

    for(uint i = 0; i < confirmedUsrAddrs.length ; i++){

      whitelisted[confirmedUsrAddrs[i]] = counter;

      counter += 1;
    }

    whitelisted[_fliquidator] = LIMIT_USERS+1;

    timeblock = block.number;

  }

  /**
 * @dev Throws if called by any account that is not Whitelisted.
 */
  modifier isWhitelisted(){
    require(whitelisted[msg.sender] != 0, Errors.SP_ALPHA_ADDR_NOT_WHTLIST);
    _;
  }


  /**
  * @dev Adds a user's address to the Fuji Whitelist
  * Emits a {userWhitelisted} event.
  */
  function addmetowhitelist() public nonReentrant {

    require(whitelisted[msg.sender] == 0, Errors.SP_ALPHA_ADDR_OK_WHTLIST);
    require(counter <= LIMIT_USERS, Errors.SP_ALPHA_WHTLIST_FULL);
    require(block.number > timeblock + 50, Errors.SP_ALPHA_WAIT_BLOCKLAG);

    whitelisted[msg.sender] = counter;
    counter += 1;

    timeblock = block.number;

    emit userWhitelisted(msg.sender, counter);
  }

  function isAddrWhitelisted(address _usrAddrs) external view returns(bool) {
    if (whitelisted[_usrAddrs] != 0) {
      return true;
    } else {
      return false;
    }
  }

}
