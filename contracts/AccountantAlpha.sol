// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

import {IAccountant} from "./IAccountant.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract AccountantAlpha is IAccountant {

  using SafeMath for uint256;

  //Authorized Vaults
  mapping (address => bool ) vaultRegistry;

  //Balance per collateral asset in native underlying
  mapping (address => uint256) balanceCollateralMarket;


  modifier onlyVault() {
    require(
      isVault(msg.sender),
      Errors.VL_NOT_AUTHORIZED);
    _;
  }


  function addCollateraltoUser(address _user, address _collateralAsset, uint256 _AmounttoAdd) external override onlyVault {
    //TODO
  }

  function subCollateraltoUser(address _user, address _collateralAsset, uint256 _AmountoSub) external override onlyVault {
    //TODO
  }

  function getUserCollateralTypeBal(address _user, address _collateralAsset) external override returns(uint256) {
    //TODO
  }

  function getUserCollateralGlobalBal(address _user) external override returns(uint256) {

  }

  function getTVLCollateralType(address _collateralAsset) external override returns(uint256) {
    //TODO
  }

  function getTVLCollateralGlobal() external override returns(uint256) {
    //TODO
  }

  //Administrative Functions

  function addVault(address _vaultaddr) public onlyOwner {

  }

  function isVault(address _addr) internal view returns(bool ){
    if(vaultRegistry[_addr]) {
      return vaultRegistry[_addr];
    } else {
      return false;
    }
  }

}
