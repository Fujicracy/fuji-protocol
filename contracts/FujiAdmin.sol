// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12 <0.8.0;

import { IFujiAdmin } from "./IFujiAdmin.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract FujiAdmin is IFujiAdmin, Ownable {
  address[] private _vaults;
  address private _flasher;
  address private _fliquidator;
  address payable private _ftreasury;
  address private _controller;
  address private _aWhiteList;
  address private _vaultHarvester;

  struct Factor {
    uint64 a;
    uint64 b;
  }

  // Bonus Factor for Flash Liquidation
  Factor public bonusFlashL;

  // Bonus Factor for normal Liquidation
  Factor public bonusL;

  constructor() public {
    // 0.04
    bonusFlashL.a = 1;
    bonusFlashL.b = 25;

    // 0.05
    bonusL.a = 1;
    bonusL.b = 20;
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
   * @dev Sets the Whitelistingcontract address
   * @param _newAWhiteList: controller address
   */
  function setaWhitelist(address _newAWhiteList) external onlyOwner {
    _aWhiteList = _newAWhiteList;
  }

  /**
   * @dev Sets the VaultHarvester address
   * @param _newVaultHarverster: controller address
   */
  function setVaultHarvester(address _newVaultHarverster) external onlyOwner {
    _vaultHarvester = _newVaultHarverster;
  }

  /**
   * @dev Set Factors "a" and "b" for a Struct Factor
   * For bonusL; Sets the Bonus for normal Liquidation, should be < 1, a/b
   * For bonusFlashL; Sets the Bonus for flash Liquidation, should be < 1, a/b
   * @param _newFactorA: A number
   * @param _newFactorB: A number
   * @param _isbonusFlash: is bonusFlashFactor
   */
  function setFactor(
    uint64 _newFactorA,
    uint64 _newFactorB,
    bool _isbonusFlash
  ) external onlyOwner {
    if (_isbonusFlash) {
      bonusFlashL.a = _newFactorA;
      bonusFlashL.b = _newFactorB;
    } else {
      bonusL.a = _newFactorA;
      bonusL.b = _newFactorB;
    }
  }

  /**
   * @dev Adds a Vault.
   * @param _vaultAddr: Address of vault to be added
   */
  function addVault(address _vaultAddr) external onlyOwner {
    //Loop to check if vault address is already there
    _vaults.push(_vaultAddr);
  }

  /**
   * @dev Overrides a Vault address at location in the vaults Array
   * @param _position: position in the array
   * @param _vaultAddr: new provider fuji address
   */
  function overrideVault(uint8 _position, address _vaultAddr) external onlyOwner {
    _vaults[_position] = _vaultAddr;
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

  function getaWhiteList() external view override returns (address) {
    return _aWhiteList;
  }

  function getVaultHarvester() external view override returns (address) {
    return _vaultHarvester;
  }

  function getvaults() external view returns (address[] memory theVaults) {
    theVaults = _vaults;
  }

  function getBonusFlashL() external view override returns (uint64, uint64) {
    return (bonusFlashL.a, bonusFlashL.b);
  }

  function getBonusLiq() external view override returns (uint64, uint64) {
    return (bonusL.a, bonusL.b);
  }
}
