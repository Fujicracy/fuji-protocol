// SPDX-License-Identifier: MIT

pragma solidity >= 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IFujiERC1155 is IERC1155 {

  //General Getter Functions

  function getAssetID(uint8 _Type, address _assetAddr) external view returns(uint256);

  function getQtyOfManagedAssets() external view returns(uint256);

  function IDsCollateralsAssets() external view returns(uint256[] memory);

  function IDsBorrowAssets() external view returns(uint256[] memory);

  function TotalAsset_IDBalances(uint256 _Id) external view returns (uint256);

  //Permit Controlled  Functions
  function mint(address account, uint256 id, uint256 amount, bytes memory data) external;

  function burn(address account, uint256 id, uint256 amount) external;



}
