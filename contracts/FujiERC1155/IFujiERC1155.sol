// SPDX-License-Identifier: MIT

pragma solidity >= 0.6.12;
pragma experimental ABIEncoderV2;

interface IFujiERC1155 {

  //Asset Types
  enum AssetType {
    //uint8 = 0
    collateralToken,
    //uint8 = 1
    debtToken
  }

  //General Getter Functions

  function getAssetID(AssetType _Type, address _assetAddr) external view returns(uint256);

  function qtyOfManagedAssets() external view returns(uint64);

  function balanceOf(address account, uint256 id) external view returns (uint256);

  //function splitBalanceOf(address account,uint256 _AssetID) external view  returns (uint256,uint256);

  //function balanceOfBatchType(address account, AssetType _Type) external view returns (uint256);

  //Permit Controlled  Functions
  function mint(address account, uint256 id, uint256 amount, bytes memory data) external;

  function burn(address account, uint256 id, uint256 amount) external;

  function updateState(uint256 _AssetID, uint256 newBalance) external;

  function addInitializeAsset(AssetType _Type, address _Addr) external returns(uint64);

}
