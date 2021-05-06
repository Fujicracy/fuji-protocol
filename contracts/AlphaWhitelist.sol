// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.8.0;

import { IAlphaWhiteList } from "./IAlphaWhiteList.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Errors } from "./Libraries/Errors.sol";
import { IFujiERC1155 } from "./FujiERC1155/IFujiERC1155.sol";

import "hardhat/console.sol"; //test line

contract AlphaWhitelist is IAlphaWhiteList, ReentrancyGuard, Ownable {
  using SafeMath for uint256;

  uint256 public ethCapValue;
  uint256 public limitUsers;
  uint256 public counter;

  mapping(address => uint256) public whiteListed;

  // Log User entered
  event UserWhitelisted(address _userAddrs, uint256 _counter);

  // Log Limit Users Changed
  event UserLimitUpdated(uint256 newUserLimit);

  // Log Cap Value Changed
  event CapValueUpdated(uint256 newCapValue);

  constructor(
    uint256 _limitUsers,
    uint256 _capValue,
    address _fliquidator
  ) public {
    limitUsers = _limitUsers;
    ethCapValue = _capValue;

    _addMeToWhitelist(_fliquidator);
  }

  /**
   * @dev Adds a user's address to the Fuji Whitelist
   * Emits a {UserWhitelisted} event.
   */
  function _addMeToWhitelist(address _usrAddr) private nonReentrant {
    require(whiteListed[_usrAddr] == 0, Errors.SP_ALPHA_WHITELIST);
    require(counter <= limitUsers, Errors.SP_ALPHA_WHITELIST);

    whiteListed[_usrAddr] = counter;
    counter = counter.add(1);

    emit UserWhitelisted(_usrAddr, counter);
  }

  /**
   * @dev Does Whitelist Routine to check if:
   * - limit of users got reached
   * - first deposit is less than ethCapValue
   * - subsequent total deposits are less than 2*ethCapValue
   * @param _usrAddr: Address of the User to check
   * @return letgo a boolean that allows a function to continue in "require" context
   */
  function whiteListRoutine(
    address _usrAddr,
    uint64 _assetID,
    uint256 _amount,
    address _erc1155
  ) external override returns (bool letgo) {
    uint256 currentBalance = IFujiERC1155(_erc1155).balanceOf(_usrAddr, _assetID);
    if (currentBalance == 0) {
      counter = counter.add(1);
      letgo = _amount <= ethCapValue && counter <= limitUsers;
    } else {
      letgo = currentBalance.add(_amount) <= ethCapValue.mul(2);
    }
  }

  // Administrative Functions

  /**
   * @dev Modifies the limitUsers
   * @param _newUserLimit: New User Limint number
   */
  function updateLimitUser(uint256 _newUserLimit) public onlyOwner {
    limitUsers = _newUserLimit;
    emit UserLimitUpdated(_newUserLimit);
  }

  /**
   * @dev Modifies the ethCapValue
   * @param _newEthCapValue: New ethCapValue
   */
  function updateCap(uint256 _newEthCapValue) public onlyOwner {
    ethCapValue = _newEthCapValue;
    emit CapValueUpdated(_newEthCapValue);
  }
}
