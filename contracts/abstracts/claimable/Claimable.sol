// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @dev Abstract contract that implements a modified version of  Openzeppelin {Ownable.sol} contract.
 * It creates a two step process for the transfer of ownership.
 */

abstract contract Claimable is Context {
  address private _owner;

  address public pendingOwner;

  // Claimable Events

  /**
   * @dev Emits when step two in ownership transfer is completed.
   */
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
  /**
   * @dev Emits when step one in ownership transfer is initiated.
   */
  event NewPendingOwner(address indexed owner);

  /**
   * @dev Initializes the contract setting the deployer as the initial owner.
   */
  constructor() {
    address msgSender = _msgSender();
    _owner = msgSender;
    emit OwnershipTransferred(address(0), msgSender);
  }

  /**
   * @dev Returns the address of the current owner.
   */
  function owner() public view virtual returns (address) {
    return _owner;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(_msgSender() == owner(), "Ownable: caller is not the owner");
    _;
  }

  /**
   * @dev Throws if called by any account other than the pendingOwner.
   */
  modifier onlyPendingOwner() {
    require(_msgSender() == pendingOwner);
    _;
  }

  /**
   * @dev Leaves the contract without owner. It will not be possible to call
   * `onlyOwner` functions anymore. Can only be called by the current owner.
   *
   * NOTE: Renouncing ownership will leave the contract without an owner,
   * thereby removing any functionality that is only available to the owner.
   */
  function renounceOwnership() public virtual onlyOwner {
    emit OwnershipTransferred(owner(), address(0));
    _owner = address(0);
  }

  /**
   * @dev Step one of ownership transfer.
   * Initiates transfer of ownership of the contract to a new account (`newOwner`).
   * Can only be called by the current owner.
   *
   * NOTE:`newOwner` requires to claim ownership in order to be able to call
   * {onlyOwner} modified functions.
   */
  function transferOwnership(address newOwner) public virtual onlyOwner {
    require(newOwner != address(0), "Cannot pass zero address!");
    require(pendingOwner == address(0), "There is a pending owner!");
    pendingOwner = newOwner;
    emit NewPendingOwner(newOwner);
  }

  /**
   * @dev Cancels the transfer of ownership of the contract.
   * Can only be called by the current owner.
   */
  function cancelTransferOwnership() public onlyOwner {
    require(pendingOwner != address(0));
    delete pendingOwner;
    emit NewPendingOwner(address(0));
  }

  /**
   * @dev Step two of ownership transfer.
   * 'pendingOwner' claims ownership of the contract.
   * Can only be called by the pending owner.
   */
  function claimOwnership() public onlyPendingOwner {
    emit OwnershipTransferred(owner(), pendingOwner);
    _owner = pendingOwner;
    delete pendingOwner;
  }
}
