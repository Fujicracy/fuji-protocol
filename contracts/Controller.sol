// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IVault } from "./IVault.sol";
import { IProvider } from "./IProvider.sol";
import { Flasher } from "./flashloans/Flasher.sol";
import { FlashLoan } from "./flashloans/LibFlashLoan.sol";
import { Errors } from "../Libraries/Errors.sol";

import "hardhat/console.sol"; //test line

contract Controller is Ownable {

  address public flasherAddr;
  address public fliquidator;

  //Refinancing Variables
  bool public greenLight;
  uint256 public lastRefinancetimestamp;
  uint256 public deltatimestampThreshold;
  uint256 public deltaAPRThreshold; //Expressed in ray (1e27)

  //State variables to control vault providers
  address[] public vaults;

  //Modifiers
  modifier isAuthorized() {
    require(msg.sender == owner() || msg.sender == address(this), "!authorized");
    _;
  }

  constructor(

    address _flasher,
    address _fliquidator,
    uint256 _deltaAPRThreshold,

  ) public {
    // Add initializer addresses
    flasherAddr = _flasher;
    fliquidator = _fliquidator;
    deltaAPRThreshold = _deltaAPRThreshold;
    greenLight = false;
  }

  //Administrative functions

  /**
  * @dev Adds a Vault to the controller.
  * @param _vaultAddr: Address of vault to be added
  */
  function addVault(
    address _vaultAddr
  ) external isAuthorized {
    bool alreadyIncluded = false;

    //Check if Vault is already included
    for (uint i =0; i < vaults.length; i++ ) {
      if (vaults[i] == _vaultAddr) {
        alreadyIncluded = true;
      }
    }
    require(alreadyIncluded == false, "Vault is already included in Controller");

    //Loop to check if vault address is already there
    vaults.push(_vaultAddr);
  }

  /**
  * @dev Getter Function for the array of vaults in the controller.
  */
  function getvaults() external view returns(address[] memory theVaults) {
    theVaults = vaults;
  }

  /**
   * @dev Overrides a Vault address at location in the vaults Array
   * @param _position: position in the array
   * @param _vaultAddr: new provider fuji address
   */
   function overrideVault(uint8 _position, address _vaultAddr) external isAuthorized {
     vaults[_position] = _vaultAddr;
   }

   /**
    * @dev Changes the conditional Threshold for a provider switch
    * @param _newThreshold: percent decimal in ray (example 25% =.25 x10^27)
    */
    function setdeltaAPRThreshold(uint256 _newThreshold) external isAuthorized {
      deltaAPRThreshold = _newThreshold;
    }

    /**
    * @dev Changes the flasher contract address
    * @param _newFlasher: address of new flasher contract
    */
    function setFlasher(address _newFlasher) external isAuthorized {
      flasherAddr = _newFlasher;
    }

    /**
    * @dev Sets the fliquidator address
    * @param _newfliquidator: new fliquidator address
    */
    function setfliquidator(address _newfliquidator) external isAuthorized {
      fliquidator = _newfliquidator;
    }

    /**
    * @dev Sets the Green light to proceed with a Refinancing opportunity
    * @param _lightstate: True or False
    */
    function setLight(bool _lightstate) external isAuthorized {
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
    function _setRefinanceTimestamp() internal {
      lastRefinancetimestamp = block.timestamp;

    }

  //Controller Core functions

  /**
  * @dev Performs full refinancing routine, performs checks for verification
  * @param _vaultAddr: fuji Vault address
  * @return true if provider got switched, false if no change
  */
  function doRefinancing(address _vaultAddr) external returns(bool) {

    // Check Server Script has confirmed an opportunity to refinance
    require(greenLight, Errors.RF_NO_GREENLIGHT);

    IVault vault = IVault(_vaultAddr);
    vault.updateF1155Balances();
    uint256 debtPosition = vault.borrowBalance(vault.activeProvider());

    //Check if there is an opportunity to Change provider with a lower borrowing Rate
    (bool opportunityTochange, address newProvider) = checkRates(_vaultAddr);

    if (opportunityTochange) {
      //Check how much borrowed balance along with accrued interest at current Provider

      //Initiate Flash Loan Struct
      FlashLoan.Info memory info = FlashLoan.Info({
        callType: FlashLoan.CallType.Switch,
        asset: vault.getBorrowAsset(),
        amount: debtPosition,
        vault: _vaultAddr,
        newProvider: newProvider,
        user: address(0),
        userliquidator: address(0),
        fliquidator: fliquidator
      });

      Flasher(flasherAddr).initiateDyDxFlashLoan(info);

      //Set the new provider in the Vault
      setProvider(_vaultAddr, address(newProvider));
      _setRefinanceTimestamp();
      return true;
    }
    else {
      return false;
    }
  }

  /**
  * @dev Compares borrowing rates from providers of a vault
  * @param _vaultAddr: Fuji vault address
  * @return Success or not, and the Iprovider address with lower borrow rate if greater than deltaAPRThreshold
  */
  function checkRates(
    address _vaultAddr
  ) public view returns(bool, address) {
    //Get the array of Providers from _vaultAddr
    address[] memory arrayOfProviders = IVault(_vaultAddr).getProviders();
    address borrowingAsset = IVault(_vaultAddr).getBorrowAsset();
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
