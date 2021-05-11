// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IVault } from "./Vaults/IVault.sol";
import { IProvider } from "./Providers/IProvider.sol";
import { Flasher } from "./Flashloans/Flasher.sol";
import { FlashLoan } from "./Flashloans/LibFlashLoan.sol";
import { IFujiAdmin } from "./IFujiAdmin.sol";
import { Errors } from "./Libraries/Errors.sol";

interface IVaultExt is IVault {
  //Asset Struct
  struct VaultAssets {
    address collateralAsset;
    address borrowAsset;
    uint64 collateralID;
    uint64 borrowID;
  }

  function vAssets() external view returns (VaultAssets memory);
}

interface IProviderExt is IProvider {
  // Temp
  function getBorrowBalanceExact(address _asset, address who) external returns (uint256);
}

contract Controller is Ownable {
  using SafeMath for uint256;

  IFujiAdmin private _fujiAdmin;

  /**
   * @dev Sets the fujiAdmin Address
   * @param _newFujiAdmin: FujiAdmin Contract Address
   */
  function setFujiAdmin(address _newFujiAdmin) public onlyOwner {
    _fujiAdmin = IFujiAdmin(_newFujiAdmin);
  }

  /**
   * @dev Performs a forced refinancing routine
   * @param _vaultAddr: fuji Vault address
   * @param _newProvider: new provider address
   * @param _ratioA: ratio to determine how much of debtposition to move
   * @param _ratioB: _ratioA/_ratioB <= 1, and > 0
   * @param _flashnum: integer identifier of flashloan provider
   * @param _isCompoundActiveProvider: indicate if activeProvider is Compound
   */
  function doRefinancing(
    address _vaultAddr,
    address _newProvider,
    uint256 _ratioA,
    uint256 _ratioB,
    uint8 _flashnum,
    bool _isCompoundActiveProvider
  ) external onlyOwner {
    IVault vault = IVault(_vaultAddr);
    IVaultExt.VaultAssets memory vAssets = IVaultExt(_vaultAddr).vAssets();
    vault.updateF1155Balances();

    // Check Vault borrowbalance and apply ratio (consider compound or not)
    uint256 debtPosition =
      _isCompoundActiveProvider
        ? IProviderExt(vault.activeProvider()).getBorrowBalanceExact(
          vAssets.borrowAsset,
          _vaultAddr
        )
        : vault.borrowBalance(vault.activeProvider());
    uint256 applyRatiodebtPosition = debtPosition.mul(_ratioA).div(_ratioB);

    // Check Ratio Input and Vault Balance at ActiveProvider
    require(
      debtPosition >= applyRatiodebtPosition && applyRatiodebtPosition > 0,
      Errors.RF_INVALID_RATIO_VALUES
    );

    //Initiate Flash Loan Struct
    FlashLoan.Info memory info =
      FlashLoan.Info({
        callType: FlashLoan.CallType.Switch,
        asset: vAssets.borrowAsset,
        amount: applyRatiodebtPosition,
        vault: _vaultAddr,
        newProvider: _newProvider,
        user: address(0),
        userliquidator: address(0),
        fliquidator: address(0)
      });

    Flasher(payable(_fujiAdmin.getFlasher())).initiateFlashloan(info, _flashnum);

    IVault(_vaultAddr).setActiveProvider(_newProvider);
  }
}
