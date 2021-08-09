// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

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

contract Controller is Ownable {
  IFujiAdmin private _fujiAdmin;

  modifier isValidVault(address _vaultAddr) {
    require(_fujiAdmin.validVault(_vaultAddr), "Invalid vault!");
    _;
  }

  /**
   * @dev Sets the fujiAdmin Address
   * @param _newFujiAdmin: FujiAdmin Contract Address
   */
  function setFujiAdmin(address _newFujiAdmin) external onlyOwner {
    _fujiAdmin = IFujiAdmin(_newFujiAdmin);
  }

  /**
   * @dev Performs a forced refinancing routine
   * @param _vaultAddr: fuji Vault address
   * @param _newProvider: new provider address
   * @param _ratioA: ratio to determine how much of debtposition to move
   * @param _ratioB: _ratioA/_ratioB <= 1, and > 0
   * @param _flashNum: integer identifier of flashloan provider
   */
  function doRefinancing(
    address _vaultAddr,
    address _newProvider,
    uint256 _ratioA,
    uint256 _ratioB,
    uint8 _flashNum
  ) external isValidVault(_vaultAddr) onlyOwner {
    IVault vault = IVault(_vaultAddr);
    IVaultExt.VaultAssets memory vAssets = IVaultExt(_vaultAddr).vAssets();
    vault.updateF1155Balances();

    // Check Vault borrowbalance and apply ratio (consider compound or not)
    uint256 debtPosition = IProvider(vault.activeProvider()).getBorrowBalanceOf(
      vAssets.borrowAsset,
      _vaultAddr
    );
    uint256 applyRatiodebtPosition = (debtPosition * _ratioA) / _ratioB;

    // Check Ratio Input and Vault Balance at ActiveProvider
    require(
      debtPosition >= applyRatiodebtPosition && applyRatiodebtPosition > 0,
      Errors.RF_INVALID_RATIO_VALUES
    );

    //Initiate Flash Loan Struct
    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.Switch,
      asset: vAssets.borrowAsset,
      amount: applyRatiodebtPosition,
      vault: _vaultAddr,
      newProvider: _newProvider,
      userAddrs: new address[](0),
      userBalances: new uint256[](0),
      userliquidator: address(0),
      fliquidator: address(0)
    });

    Flasher(payable(_fujiAdmin.getFlasher())).initiateFlashloan(info, _flashNum);

    IVault(_vaultAddr).setActiveProvider(_newProvider);
  }
}
