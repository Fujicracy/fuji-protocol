// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./interfaces/IFujiAdmin.sol";
import "./libraries/Errors.sol";

/**
 * @dev Contract that controls the addresses of the Fuji Protocol contracts
 */

contract FujiAdmin is IFujiAdmin, OwnableUpgradeable {
  address private _flasher;
  address private _fliquidator;
  address payable private _ftreasury;
  address private _controller;
  address private _vaultHarvester;

  mapping(address => bool) public override validVault;

  address private _swapper;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {}

  /**
   * @dev Initializes the contract setting the deployer as the initial owner.
   */
  function initialize() external initializer {
    __Ownable_init();
  }

  // Setter Functions

  /**
   * @dev Sets the flasher contract address
   * @param _newFlasher: flasher address
   */
  function setFlasher(address _newFlasher) external onlyOwner {
    require(_newFlasher != address(0), Errors.VL_ZERO_ADDR);
    _flasher = _newFlasher;
    emit FlasherChanged(_newFlasher);
  }

  /**
   * @dev Sets the fliquidator contract address
   * @param _newFliquidator: new fliquidator address
   */
  function setFliquidator(address _newFliquidator) external onlyOwner {
    require(_newFliquidator != address(0), Errors.VL_ZERO_ADDR);
    _fliquidator = _newFliquidator;
    emit FliquidatorChanged(_newFliquidator);
  }

  /**
   * @dev Sets the Treasury contract address
   * @param _newTreasury: new Fuji Treasury address
   */
  function setTreasury(address payable _newTreasury) external onlyOwner {
    require(_newTreasury != address(0), Errors.VL_ZERO_ADDR);
    _ftreasury = _newTreasury;
    emit TreasuryChanged(_newTreasury);
  }

  /**
   * @dev Sets the controller contract address.
   * @param _newController: controller address
   */
  function setController(address _newController) external onlyOwner {
    require(_newController != address(0), Errors.VL_ZERO_ADDR);
    _controller = _newController;
    emit ControllerChanged(_newController);
  }

  /**
   * @dev Sets the VaultHarvester address
   * @param _newVaultHarverster: controller address
   */
  function setVaultHarvester(address _newVaultHarverster) external onlyOwner {
    require(_newVaultHarverster != address(0), Errors.VL_ZERO_ADDR);
    _vaultHarvester = _newVaultHarverster;
    emit VaultHarvesterChanged(_newVaultHarverster);
  }

  /**
   * @dev Sets the Swapper address
   * @param _newSwapper: controller address
   */
  function setSwapper(address _newSwapper) external onlyOwner {
    require(_newSwapper != address(0), Errors.VL_ZERO_ADDR);
    _swapper = _newSwapper;
    emit SwapperChanged(_newSwapper);
  }

  /**
   * @dev Changes the Vault permission.
   * @param _vaultAddr: Address of the vault
   * @param _permission: permission boolean
   */
  function allowVault(address _vaultAddr, bool _permission) external onlyOwner {
    require(_vaultAddr != address(0), Errors.VL_ZERO_ADDR);
    validVault[_vaultAddr] = _permission;
    emit VaultPermitChanged(_vaultAddr, _permission);
  }

  // Getter Functions

  /**
   * @dev Returns the current '_flasher' address.
   */
  function getFlasher() external view override returns (address) {
    return _flasher;
  }

  /**
   * @dev Returns the current '_fliquidator' address.
   */
  function getFliquidator() external view override returns (address) {
    return _fliquidator;
  }

  /**
   * @dev Returns the current '_ftreasury' address.
   */
  function getTreasury() external view override returns (address payable) {
    return _ftreasury;
  }

  /**
   * @dev Returns the current '_controller' address.
   */
  function getController() external view override returns (address) {
    return _controller;
  }

  /**
   * @dev Returns the current '_vaultHarvester' address.
   */
  function getVaultHarvester() external view override returns (address) {
    return _vaultHarvester;
  }

  /**
   * @dev Returns the current '_swapper' address.
   */
  function getSwapper() external view override returns (address) {
    return _swapper;
  }
}
