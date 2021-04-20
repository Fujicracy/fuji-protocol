// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.8.0;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Errors } from './Libraries/Errors.sol';
import { IFujiERC1155 } from "./FujiERC1155/IFujiERC1155.sol";

contract AlphaWhitelist is ReentrancyGuard, Ownable {

  using SafeMath for uint256;

  uint256 public ETH_CAP_VALUE;
  uint256 public LIMIT_USERS;
  uint256 public counter;

  mapping(address => uint256) public whitelisted;

  // Log User entered
	event userWhitelisted(address _userAddrs, uint256 _counter);

  // Log Limit Users Changed
  event userLimitUpdated(uint256 newUserLimit);

  // Log Cap Value Changed
  event capValueUpdated(uint256 newCapValue);

  constructor(

    uint256 _limitusers,
    uint256 _capvalue,
    address _fliquidator

  ) public {

    LIMIT_USERS = _limitusers;
    ETH_CAP_VALUE = _capvalue;
    counter = 0;

    addmetowhitelist(_fliquidator);

  }


  /**
  * @dev Adds a user's address to the Fuji Whitelist
  * Emits a {userWhitelisted} event.
  */
  function addmetowhitelist(address _usrAddrs) private nonReentrant {

    require(whitelisted[_usrAddrs] == 0, Errors.SP_ALPHA_ADDR_OK_WHTLIST);
    require(counter <= LIMIT_USERS, Errors.SP_ALPHA_WHTLIST_FULL);

    whitelisted[_usrAddrs] = counter;
    counter = counter.add(1);

    emit userWhitelisted(_usrAddrs, counter);
  }

  /**
  * @dev Checks if Address is in the Fuji Whitelist
  * @param _usrAddrs: Address of the User to check
  * @return True or False
  */
  function isAddrWhitelisted(address _usrAddrs) public view returns(bool) {
    if (whitelisted[_usrAddrs] != 0) {
      return true;
    } else {
      return false;
    }
  }

  /**
  * @dev Does Whitelist Routine to check if User isWhitelisted or adds them to List if there is capacity
  * @param _usrAddrs: Address of the User to check
  * @return letgo a boolean that allows a function to continue in "require" context
  */
  function whitelistRoutine(address _usrAddrs, uint64 _assetID, uint256 _amount, address _erc1155) external returns(bool letgo) {
    uint256 currentBalance = IFujiERC1155(_erc1155).balanceOf(_usrAddrs, _assetID);
    if (currentBalance == 0) {
      counter = counter.add(1);
    }

    letgo = currentBalance.add(_amount) <= ETH_CAP_VALUE && counter <= LIMIT_USERS;
  }

  // Administrative Functions

  /**
  * @dev Modifies the LIMIT_USERS
  * @param _newUserLimit: New User Limint number
  */
  function modifyLimitUser(uint256 _newUserLimit) public onlyOwner {
    LIMIT_USERS = _newUserLimit;
    emit userLimitUpdated(_newUserLimit);
  }

  /**
  * @dev Modifies the ETH_CAP_VALUE
  * @param _newETH_CAP_VALUE: New ETH_CAP_VALUE
  */
  function modifyCap(uint256 _newETH_CAP_VALUE) public onlyOwner {
    ETH_CAP_VALUE = _newETH_CAP_VALUE;
    emit capValueUpdated(_newETH_CAP_VALUE);
  }

}
