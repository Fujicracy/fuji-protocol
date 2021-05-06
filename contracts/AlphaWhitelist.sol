// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.8.0;

import { IAlphaWhiteList } from "./IAlphaWhiteList.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Errors } from './Libraries/Errors.sol';
import { IFujiERC1155 } from "./FujiERC1155/IFujiERC1155.sol";

import "hardhat/console.sol"; //test line

contract AlphaWhitelist is IAlphaWhiteList, ReentrancyGuard, Ownable {

  using SafeMath for uint256;

  uint256 public ETH_CAP_VALUE;
  uint256 public LIMIT_USERS;
  uint256 public counter;

  mapping(address => uint256) public whiteListed;

  // Log User entered
	event userWhiteListed(address _userAddrs, uint256 _counter);

  // Log Limit Users Changed
  event userLimitUpdated(uint256 newUserLimit);

  // Log Cap Value Changed
  event capValueUpdated(uint256 newCapValue);

  constructor(
    uint256 _limitUsers,
    uint256 _capValue,
    address _fliquidator
  ) public {

    LIMIT_USERS = _limitUsers;
    ETH_CAP_VALUE = _capValue;

    _addmetoWhiteList(_fliquidator);
  }


  /**
  * @dev Adds a user's address to the Fuji Whitelist
  * Emits a {userWhiteListed} event.
  */
  function _addmetoWhiteList(address _usrAddrs) private nonReentrant {

    require(whiteListed[_usrAddrs] == 0, Errors.SP_ALPHA_WHITELIST);
    require(counter <= LIMIT_USERS, Errors.SP_ALPHA_WHITELIST);

    whiteListed[_usrAddrs] = counter;
    counter = counter.add(1);

    emit userWhiteListed(_usrAddrs, counter);
  }

  /**
  * @dev Checks if Address is in the Fuji Whitelist
  * @param _usrAddrs: Address of the User to check
  * @return True or False
  */
  function isAddrWhiteListed(address _usrAddrs) public view returns(bool) {
    if (whiteListed[_usrAddrs] != 0) {
      return true;
    } else {
      return false;
    }
  }

  /**
  * @dev Does Whitelist Routine to check if:
  * - limit of users got reached
  * - first deposit is less than ETH_CAP_VALUE
  * - subsequent total deposits are less than 2*ETH_CAP_VALUE
  * @param _usrAddrs: Address of the User to check
  * @return letgo a boolean that allows a function to continue in "require" context
  */
  function whiteListRoutine(address _usrAddrs, uint64 _assetID, uint256 _amount, address _erc1155) external override returns(bool letgo) {
    uint256 currentBalance = IFujiERC1155(_erc1155).balanceOf(_usrAddrs, _assetID);
    if (currentBalance == 0) {
      counter = counter.add(1);
      letgo = _amount <= ETH_CAP_VALUE && counter <= LIMIT_USERS;
    } else {
      letgo = currentBalance.add(_amount) <= ETH_CAP_VALUE.mul(2);
    }
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
  * @param _newEthCapValue: New ETH_CAP_VALUE
  */
    function modifyCap(uint256 _newEthCapValue) public onlyOwner {
    ETH_CAP_VALUE = _newEthCapValue;
    emit capValueUpdated(_newEthCapValue);
  }

}
