// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;
pragma experimental ABIEncoderV2;

import "./VaultETHDAI.sol";
import { DebtToken } from "./DebtToken.sol";

interface ILendingPool {
  function flashLoan(
    address receiverAddress,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint16 referralCode
  ) external;
}

contract Controller {

  address private owner;
  address public flasherAddr;
  address public liquidatorAddr;
  address constant LENDING_POOL = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
  //Change Threshold is the minimum percent in Borrowing Rates to trigger a provider change
  //Percentage Expressed in ray (1e27)
  uint256 public changeThreshold;

  //State variables to control vault providers
  address[] public vaults;

  //Modifiers

  modifier isAuthorized() {
    require(msg.sender == owner || msg.sender == address(this), "!authorized");
    _;
  }

  constructor(
    address _owner,
    address _flasher,
    address _liquidator,
    uint256 _changeThreshold
  ) public {
    // Add initializer addresses
    owner = _owner;
    flasherAddr = _flasher;
    liquidatorAddr = _liquidator;
    changeThreshold = _changeThreshold;
  }

  //Administrative functions

  /**
  * @dev Adds a Vault to the controller.
  * @param _vaultAddr: fuji address of a vault contract
  */
  function addVault(
    address _vaultAddr
  ) external isAuthorized {
    bool alreadyIncluded = false;

    //Check if Vault is already included
    for(uint i =0; i < vaults.length; i++ ){
      if(vaults[i] == _vaultAddr){
        alreadyIncluded = true;
      }
    }
    require(alreadyIncluded == false, "Vault is already included in Controller");

    //Loop to check if vault address is already there
    vaults.push(_vaultAddr);
  }

  /**
  * @dev Changes the conditional Threshold for a provider switch
  * @param _newThreshold: percent decimal in ray (example 25% =.25 x10^27)
  */
  function setChangeThreshold(
    uint256 _newThreshold
  ) external isAuthorized {
    changeThreshold = _newThreshold;
  }

  /**
  * @dev Changes the flasher contract address
  * @param _newFlasher: address of new flasher contract
  */
  function setFlasher(
    address _newFlasher
  ) external isAuthorized {
    flasherAddr = _newFlasher;
  }

  /**
  * @dev Changes the liquidator contract address
  * @param _newLiquidator: address of new liquidator contract
  */
  function setLiquidator(
    address _newLiquidator
  ) external isAuthorized {
    liquidatorAddr = _newLiquidator;
  }

  /**
  * @dev Sets a new provider to called Vault, returns true on success
  * @param _vaultAddr: fuji Vault address to which active provider will change
  * @param _newProviderAddr: fuji address of new Provider
  */
  function setProvider(
    address _vaultAddr,
    address _newProviderAddr
  ) internal isAuthorized returns(bool) {
    //Create vault instance and call setActiveProvider method in that vault.
    IVault(_vaultAddr).setActiveProvider(_newProviderAddr);
  }

  //Controller Core functions

  /**
  * @dev Performs full routine to check the borrowing Rates from the
    various providers of a Vault, it swap the assets to the best provider,
    and sets a new active provider for the called Vault, returns true on
    success
  * @param _vaultAddr: fuji Vault address
  */
  function doControllerRoutine(
    address _vaultAddr
  ) public returns(bool) {

    //Check if there is an opportunity to Change provider with a lower borrowing Rate
    (bool opportunityTochange, address newProvider) = checkRates(_vaultAddr);

    if (opportunityTochange) {
      //Check how much borrowed balance along with accrued interest at current Provider

        //Initiate Flash Loan
        _initiateFlashLoan(
          address(_vaultAddr),
          address(newProvider)
        );

      //Set the new provider in the Vault
      setProvider(_vaultAddr, address(newProvider));
      return true;
    }
    else {
      return false;
    }
  }

  /**
  * @dev Compares borrowing Rates from providers of a Vault, returns
    true on success and fuji address of the provider with best borrowing rate
  * @param _vaultAddr: fuji Vault address
  */
  function checkRates(
    address _vaultAddr
  ) public view returns(bool, address) {
    //Get the array of Providers from _vaultAddr
    address[] memory arrayOfProviders = IVault(_vaultAddr).getProviders();
    address borrowingAsset = IVault(_vaultAddr).borrowAsset();
    bool opportunityTochange = false;

    //Call and check borrow rates for all Providers in array for _vaultAddr
    uint256 currentRate = IProvider(IVault(_vaultAddr).activeProvider()).getBorrowRateFor(borrowingAsset);
    uint256 differance;
    address newProvider;

    for(uint i=0; i<arrayOfProviders.length;i++) {
      differance = (currentRate >= IProvider(arrayOfProviders[i]).getBorrowRateFor(borrowingAsset) ?
      currentRate - IProvider(arrayOfProviders[i]).getBorrowRateFor(borrowingAsset) :
      IProvider(arrayOfProviders[i]).getBorrowRateFor(borrowingAsset) - currentRate);
      if(differance >= changeThreshold && IProvider(arrayOfProviders[i]).getBorrowRateFor(borrowingAsset) < currentRate){
        currentRate = IProvider(arrayOfProviders[i]).getBorrowRateFor(borrowingAsset);
        newProvider = arrayOfProviders[i];
        opportunityTochange = true;
      }
    }
    //Returns success or not, and the Iprovider with lower borrow rate
    return (opportunityTochange, newProvider);
  }

  function initiateSelfLiquidation(
    address _vaultAddr
  ) external {
    IVault theVault = IVault(_vaultAddr);
    DebtToken debtToken = theVault.debtToken();
    theVault.updateDebtTokenBalances();
    uint256 debtPosition = debtToken.balanceOf(msg.sender);

    require(debtPosition > 0, "No debt to liquidate");

    _initiateAaveFlashLoan(
      _vaultAddr,
      msg.sender,
      theVault.borrowAsset(),
      debtPosition,
      liquidatorAddr
    );
  }

  function _initiateFlashLoan(
    address _vaultAddr,
    address _newProviderAddr
  ) internal {
    IVault theVault = IVault(_vaultAddr);
    uint256 debtPosition = theVault.borrowBalance();

    require(debtPosition > 0, "No debt to liquidate");

    _initiateAaveFlashLoan(
      _vaultAddr,
      _newProviderAddr,
      theVault.borrowAsset(),
      debtPosition,
      flasherAddr
    );
  }

  function _initiateAaveFlashLoan(
    address _vaultAddr,
    address _otherAddr,
    address _borrowAsset,
    uint256 _amount,
    address _receiverAddr
  ) internal {
     //Initialize Instance of Aave Lending Pool
     ILendingPool aaveLp = ILendingPool(LENDING_POOL);

     //Passing arguments to construct Aave flashloan -limited to 1 asset type for now.
     address receiverAddress = _receiverAddr;
     address[] memory assets = new address[](1);
     assets[0] = address(_borrowAsset);
     uint256[] memory amounts = new uint256[](1);
     amounts[0] = _amount;

     // 0 = no debt, 1 = stable, 2 = variable
     uint256[] memory modes = new uint256[](1);
     modes[0] = 0;

     address onBehalfOf = address(this);
     bytes memory params = abi.encode(_vaultAddr, _otherAddr);
     uint16 referralCode = 0;

    //Aave Flashloan initiated.
    aaveLp.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
          );
  }
}
