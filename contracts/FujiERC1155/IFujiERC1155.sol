// SPDX-License-Identifier: MIT

pragma solidity >= 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IFujiERC1155 is IERC1155 {

  //Asset Types
  enum AssetType {
    //uint8 = 0
    collateralToken,
    //uint8 = 1
    debtToken
  }

  //General Getter Functions

  function getAssetID(AssetType _Type, address _assetAddr) external view override returns(uint64)

  function getQtyOfManagedAssets() external view returns(uint256);

  function IDsCollateralsAssets() external view returns(uint256[] memory);

  function IDsBorrowAssets() external view returns(uint256[] memory);

  function balanceOfBatchType(address account, AssetType _Type) external view returns (uint256);

  //Permit Controlled  Functions
  function mint(address account, uint256 id, uint256 amount, bytes memory data) external;

  function burn(address account, uint256 id, uint256 amount) external;

  function addInitializeAsset(AssetType _Type, address _Addr) external override returns(uint64);

}
