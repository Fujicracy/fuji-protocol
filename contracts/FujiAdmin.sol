// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12 <0.8.0;

import { IFujiAdmin } from "./IFujiAdmin.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract FujiAdmin is IFujiAdmin, Ownable {

  address[] private vaults;
  address private flasher;
  address private fliquidator;
  address payable private ftreasury;
  address private controller;
  address private aWhitelist;
  address private vaultharvester;

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
  * @param _newflasher: flasher address
  */
  function setFlasher(address _newflasher) external  onlyOwner {
    flasher = _newflasher;
  }

  /**
  * @dev Sets the fliquidator contract address
  * @param _newfliquidator: new fliquidator address
  */
  function setFliquidator(address _newfliquidator) external  onlyOwner {
    fliquidator = _newfliquidator;
  }

  /**
  * @dev Sets the Treasury contract address
  * @param _newTreasury: new Fuji Treasury address
  */
  function setTreasury(address payable _newTreasury) external onlyOwner {
    ftreasury = _newTreasury;
  }

  /**
  * @dev Sets the controller contract address.
  * @param _newcontroller: controller address
  */
  function setController(address _newcontroller) external onlyOwner {
    controller = _newcontroller;
  }

  /**
  * @dev Sets the Whitelistingcontract address
  * @param _newaWhitelist: controller address
  */
  function setaWhitelist(address _newaWhitelist) external  onlyOwner  {
    aWhitelist = _newaWhitelist;
  }

  /**
  * @dev Sets the VaultHarvester address
  * @param _newVaultharvester: controller address
  */
  function setvaultharvester(address _newVaultharvester) external  onlyOwner  {
    vaultharvester = _newVaultharvester;
  }

  /**
  * @dev Set Factors "a" and "b" for a Struct Factor
  * For bonusL; Sets the Bonus for normal Liquidation, should be < 1, a/b
  * For bonusFlashL; Sets the Bonus for flash Liquidation, should be < 1, a/b
  * @param _newFactorA: A number
  * @param _newFactorB: A number
  * @param _isbonusFlash: is bonusFlashFactor
  */
  function setFactor(uint64 _newFactorA, uint64 _newFactorB, bool _isbonusFlash) external onlyOwner {
    if(_isbonusFlash) {
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
    vaults.push(_vaultAddr);
  }

  /**
  * @dev Overrides a Vault address at location in the vaults Array
  * @param _position: position in the array
  * @param _vaultAddr: new provider fuji address
  */
  function overrideVault(uint8 _position, address _vaultAddr) external onlyOwner {
    vaults[_position] = _vaultAddr;
  }


  // Getter Functions

  function getFlasher() external override view returns(address) {
    return flasher;
  }

  function getFliquidator() external override view returns(address) {
    return fliquidator;
  }

  function getTreasury() external override view returns(address payable) {
    return ftreasury;
  }

  function getController() external override view returns(address) {
    return controller;
  }

  function getaWhitelist() external override view returns(address) {
    return aWhitelist;
  }

  function getvaultharvester() external override view returns(address) {
    return vaultharvester;
  }

  function getvaults() external view returns(address[] memory theVaults) {
    theVaults = vaults;
  }

  function getBonusFlashL() external view override returns(uint64, uint64){
    return (bonusFlashL.a, bonusFlashL.b);
  }

  function getBonusLiq() external view override returns(uint64, uint64){
    return (bonusL.a, bonusL.b);

  }



}
