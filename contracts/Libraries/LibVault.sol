// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12 <0.8.0;


library LibVault {

  enum FactorType {safety, collateral, bonusLiq, bonusFlashLiq, flashclosefee}

  /**
  * @dev Struct of values for multiplying Factors
  * @param id:
  * @param a: Numerator Value
  * @param b: Denominator Value
  */
  struct Factor {
    FactorType ftype;
    uint64 a;
    uint64 b;
  }

  //Asset Struct
  struct VaultAssets {
    address collateralAsset;
    address borrowAsset;
    uint256 collateralID;
    uint256 borrowID;
  }


}
