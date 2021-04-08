// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

import {IAccountant} from "./IAccountant.sol";
import { IFujiERC1155 } from "./IFujiERC1155.sol";
import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

contract HelperFunct {

  function isETH(address token) internal pure returns (bool) {
    return (token == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE));
  }

}

contract AccountantAlpha is IAccountant, HelperFunct {

  using SafeMath for uint256;

  function getUserCollateralTypeBal(address _user, address _collateralAsset) external override returns(uint256) {
    //TODO
  }

  /**
  * @dev Returns the Global User Collateral in ETH
  * @param _FujiERC1155: address of the FujiERC1155
  * @param _user: address of the user
  */
  function getUserGlobalCollateralBalance(address _FujiERC1155, address _user) external override returns(uint256) {

    uint256[] memory collateralAssets = IFujiERC1155(_FujiERC1155).IDsCollateralsAssets();

    for(uint i = 0; i < collateralAssets.length ; ++i) {
      IFujiERC1155(_FujiERC1155).balanceOf(_user,collateralAssets[i]);
    }

  }

  function getTVLCollateralType(address _collateralAsset) external override returns(uint256) {
    //TODO
  }

  function getTVLCollateralGlobal() external override returns(uint256) {
    //TODO
  }

}
