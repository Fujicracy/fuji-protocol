// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IFujiAdmin } from "./IFujiAdmin.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract FujiAdmin is IFujiAdmin, OwnableUpgradeable {
  address private _flasher;
  address private _fliquidator;
  address payable private _ftreasury;
  address private _controller;
  address private _vaultHarvester;

  mapping(address => bool) public override validVault;

  function initialize() external initializer {
    __Ownable_init();
  }

  // Setter Functions

  /**
   * @dev Sets the flasher contract address
   * @param _newFlasher: flasher address
   */
  function setFlasher(address _newFlasher) external onlyOwner {
    _flasher = _newFlasher;
  }

  /**
   * @dev Sets the fliquidator contract address
   * @param _newFliquidator: new fliquidator address
   */
  function setFliquidator(address _newFliquidator) external onlyOwner {
    _fliquidator = _newFliquidator;
  }

  /**
   * @dev Sets the Treasury contract address
   * @param _newTreasury: new Fuji Treasury address
   */
  function setTreasury(address payable _newTreasury) external onlyOwner {
    _ftreasury = _newTreasury;
  }

  /**
   * @dev Sets the controller contract address.
   * @param _newController: controller address
   */
  function setController(address _newController) external onlyOwner {
    _controller = _newController;
  }

  /**
   * @dev Sets the VaultHarvester address
   * @param _newVaultHarverster: controller address
   */
  function setVaultHarvester(address _newVaultHarverster) external onlyOwner {
    _vaultHarvester = _newVaultHarverster;
  }

  /**
   * @dev Adds a Vault.
   * @param _vaultAddr: Address of vault to be added
   */
  function allowVault(address _vaultAddr, bool _allowed) external onlyOwner {
    validVault[_vaultAddr] = _allowed;
  }

  // Getter Functions

  function getFlasher() external view override returns (address) {
    return _flasher;
  }

  function getFliquidator() external view override returns (address) {
    return _fliquidator;
  }

  function getTreasury() external view override returns (address payable) {
    return _ftreasury;
  }

  function getController() external view override returns (address) {
    return _controller;
  }

  function getVaultHarvester() external view override returns (address) {
    return _vaultHarvester;
  }
}
