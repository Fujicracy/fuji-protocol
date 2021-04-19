// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12 <0.8.0;

import { IFujiAdmin } from "./IFujiAdmin.sol";
import { LibVault } from "./Libraries/LibVault.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract FujiAdmin is IFujiAdmin, Ownable {

  address[] public vaults;
  address public flasher;
  address public fliquidator;
  address payable public ftreasury;
  address public controller;
  address public aWhitelist;

  enum FactorType {safety, collateral, bonusLiq, bonusFlashLiq, flashclosefee}

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
  function setfliquidator(address _newfliquidator) external  onlyOwner {
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
  * @param _controller: controller address
  */
  function setController(address _controller) external onlyOwner {
    controller = _controller;
  }

  /**
  * @dev Sets the Whitelistingcontract address
  * @param _newaWhitelist: controller address
  */
  function setaWhitelist(address _newaWhitelist) external  onlyOwner  {
  }

  /**
  * @dev Set Factors "a" and "b" for a Struct Factor
  * For bonusL; Sets the Bonus for normal Liquidation, should be < 1, a/b
  * For bonusFlashL; Sets the Bonus for flash Liquidation, should be < 1, a/b
  * @param _type: enum FactorType
  * @param _newFactorA: A number
  * @param _newFactorB: A number
  */
  function setFactor(FactorType _type, uint64 _newFactorA, uint64 _newFactorB) external onlyOwner {
    if(_type == FactorType.bonusFlashLiq) {
      bonusFlashL.a = _newFactorA;
      bonusFlashL.b = _newFactorB;
    } else if (_type == FactorType.bonusLiq) {
      bonusL.a = _newFactorA;
      bonusL.b = _newFactorB;
    }
  }


  /**
  * @dev Adds a Vault.
  * @param _vaultAddr: Address of vault to be added
  */
  function addVault(address _vaultAddr) external onlyOwner {
    bool alreadyIncluded = false;

    //Check if Vault is already included
    for (uint i =0; i < vaults.length; i++ ) {
      if (vaults[i] == _vaultAddr) {
        alreadyIncluded = true;
      }
    }
    require(alreadyIncluded == false, "Vault is already included in Controller");

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

  function getFlasher() external override returns(address) {
    return flasher;
  }

  function getFliquidator() external override returns(address) {
    return fliquidator;
  }

  function getTreasury() external override returns(address payable) {
    return ftreasury;
  }

  function getController() external override returns(address) {
    return controller;
  }

  function getaWhitelist() external override returns(address) {
    return aWhitelist;
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
