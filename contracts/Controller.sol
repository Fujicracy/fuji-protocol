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

import "hardhat/console.sol"; //test line

interface IVaultExt is IVault {

  //Asset Struct
  struct VaultAssets {
    address collateralAsset;
    address borrowAsset;
    uint64 collateralID;
    uint64 borrowID;
  }

  function vAssets() external view returns(VaultAssets memory);

}


contract Controller is Ownable {

  using SafeMath for uint256;

  IFujiAdmin private fujiAdmin;

  //Refinancing Variables
  bool public greenLight;
  //uint256 public lastRefinancetimestamp;

  //deltaAPRThreshold: Expressed in ray (1e27), where 1ray = 100% APR
  uint256 public deltaAPRThreshold;

  //Modifiers
  modifier isAuthorized() {
    require(
      msg.sender == owner() ||
      msg.sender == address(this),
      Errors.VL_NOT_AUTHORIZED);
    _;
  }

  constructor() public {

    deltaAPRThreshold = 1e25;
    greenLight = false;

  }

  //Administrative functions

  /**
  * @dev Sets the fujiAdmin Address
  * @param _fujiAdmin: FujiAdmin Contract Address
  */
  function setfujiAdmin(address _fujiAdmin) public isAuthorized{
    fujiAdmin = IFujiAdmin(_fujiAdmin);
  }

  /**
  * @dev Changes the conditional Threshold for a provider switch
  * @param _newThreshold: percent decimal in ray (example 25% =.25 x10^27)
  */
  function setdeltaAPRThreshold(uint256 _newThreshold) external isAuthorized {
    deltaAPRThreshold = _newThreshold;
  }

  /**
  * @dev Sets the Green light to proceed with a Refinancing opportunity
  * @param _lightstate: True or False
  */
  function setLight(bool _lightstate) public isAuthorized {
    greenLight = _lightstate;
  }
  function _setLight(bool _lightstate) private {
    greenLight = _lightstate;
  }

  /**
  * @dev Sets a new provider to called Vault, returns true on success
  * @param _vaultAddr: fuji Vault address to which active provider will change
  * @param _newProviderAddr: fuji address of new Provider
  */
  function _setProvider(address _vaultAddr,address _newProviderAddr) internal {
    //Create vault instance and call setActiveProvider method in that vault.
    IVault(_vaultAddr).setActiveProvider(_newProviderAddr);
  }

  /**
  * @dev Sets current timestamp after a refinancing cycle
  */
  /*
  function _setRefinanceTimestamp() internal {
    lastRefinancetimestamp = block.timestamp;
  }
  */

  //Controller Core functions

  /**
  * @dev Performs refinancing routine, performs checks for verification
  * @param _vaultAddr: fuji Vault address
  * @param _ratioA: ratio to determine how much of debtposition to move
  * @param _ratioB: _ratioA/_ratioB <= 1, and > 0
  * @param isdydx: indicate if dydx flashloan applicable
  */
  function doRefinancing(address _vaultAddr, uint256 _ratioA, uint256 _ratioB, bool isdydx) external {

    // Check Protocol have allowed to refinance
    require(
      greenLight,
      Errors.RF_NO_GREENLIGHT
    );

    IVault vault = IVault(_vaultAddr);
    vault.updateF1155Balances();

    // Check if there is an opportunity to Change provider with a lower borrowing Rate
    (bool opportunityTochange, address newProvider) = checkRates(_vaultAddr);

    require(opportunityTochange,Errors.RF_CHECK_RATES_FALSE);

    // Check Vault borrowbalance and apply ratio
    uint256 debtPosition = vault.borrowBalance(vault.activeProvider());
    uint256 applyRatiodebtPosition = debtPosition.mul(_ratioA).div(_ratioB);
    console.log("debtPosition:",debtPosition);
    console.log("applyRatiodebtPosition:",applyRatiodebtPosition);

    // Check Ratio Input and Vault Balance at ActiveProvider
    require(
      debtPosition >= applyRatiodebtPosition &&
      applyRatiodebtPosition > 0,
      Errors.RF_INVALID_RATIO_VALUES
    );

    IVaultExt.VaultAssets memory vAssets = IVaultExt(_vaultAddr).vAssets();

    //Initiate Flash Loan Struct
    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.Switch,
      asset: vAssets.borrowAsset,
      amount: applyRatiodebtPosition,
      vault: _vaultAddr,
      newProvider: newProvider,
      user: address(0),
      userliquidator: address(0),
      fliquidator: fujiAdmin.getFliquidator()
    });

    if(isdydx) {
      Flasher(fujiAdmin.getFlasher()).initiateDyDxFlashLoan(info);
    } else {
      Flasher(fujiAdmin.getFlasher()).initiateAaveFlashLoan(info);
    }

    //Set the new provider in the Vault
    _setProvider(_vaultAddr, newProvider);
    //console.log(msg.sender, address(this));
    _setLight(false);

  }

  /**
  * @dev Compares borrowing rates from providers of a vault
  * @param _vaultAddr: Fuji vault address
  * @return Success or not, and the Iprovider address with lower borrow rate if greater than deltaAPRThreshold
  */
  function checkRates(address _vaultAddr) public view returns(bool, address) {
    //Get the array of Providers from _vaultAddr
    address[] memory arrayOfProviders = IVault(_vaultAddr).getProviders();
    IVaultExt.VaultAssets memory vAssets = IVaultExt(_vaultAddr).vAssets();
    address borrowingAsset = vAssets.borrowAsset;
    bool opportunityTochange = false;

    //Call and check borrow rates for all Providers in array for _vaultAddr
    uint256 currentRate = IProvider(IVault(_vaultAddr).activeProvider()).getBorrowRateFor(borrowingAsset);
    uint256 differance;
    address newProvider;

    for (uint i=0; i < arrayOfProviders.length; i++) {
      differance = (currentRate >= IProvider(arrayOfProviders[i]).getBorrowRateFor(borrowingAsset) ?
      currentRate - IProvider(arrayOfProviders[i]).getBorrowRateFor(borrowingAsset) :
      IProvider(arrayOfProviders[i]).getBorrowRateFor(borrowingAsset) - currentRate);
      if (differance >= deltaAPRThreshold && IProvider(arrayOfProviders[i]).getBorrowRateFor(borrowingAsset) < currentRate) {
        currentRate = IProvider(arrayOfProviders[i]).getBorrowRateFor(borrowingAsset);
        newProvider = arrayOfProviders[i];
        opportunityTochange = true;
      }
    }
    return (opportunityTochange, newProvider);
  }
}
