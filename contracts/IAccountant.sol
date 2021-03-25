// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

interface IAccountant {

  function getUserCollateralTypeBal(address _user, address _collateralAsset) external returns(uint256);

  function getUserCollateralGlobalBal(address _FujiERC1155, address _user) external returns(uint256);

  function getTVLCollateralType(address _collateralAsset) external returns(uint256);

  function getTVLCollateralGlobal() external returns(uint256);

}
