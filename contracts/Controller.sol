// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;
pragma experimental ABIEncoderV2;

import "./VaultETHDAI.sol";

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

  constructor(address _owner,address _flasher, uint256 _changeThreshold) public {
    // Add initializer addresses
    owner = _owner;
    flasherAddr = _flasher;
    changeThreshold = _changeThreshold;
  }

  //Administrative functions

  /**
  * @dev Adds a Vault to the controller.
  * @param _vault: fuji address of a vault contract
  */
  function addVault(address _vault) public isAuthorized {
    bool alreadyincluded = false;

    //Check if Vault is already included
    for(uint i =0; i < vaults.length; i++ ){
      if(vaults[i] == _vault){
        alreadyincluded = true;
      }
    }
    require(alreadyincluded== false, "Vault is already included in Controller");

    //Loop to check if vault address is already there
    vaults.push(_vault);
  }

  /**
  * @dev Changes the conditional Threshold for a provider switch
  * @param newThreshold: percent decimal in ray (example 25% =.25 x10^27)
  */
  function setChangeThreshold(uint256 newThreshold) public isAuthorized {
    changeThreshold = newThreshold;
  }

  /**
  * @dev Changes the flasher contract address
  * @param newflasher: percent decimal in ray (example 25% =.25 x10^27)
  */
  function setflasher(address newflasher) public isAuthorized {
    //Check if vault is already adde
    flasherAddr = newflasher;
  }

  //Controller Core functions

  /**
  * @dev Performs full routine to check the borrowing Rates from the
    various providers of a Vault, it swap the assets to the best provider,
    and sets a new active provider for the called Vault, returns true on
    success
  * @param _vault: fuji Vault address
  */
  function doControllerRoutine(address _vault) public returns(bool) {

    //Check if there is an opportunity to Change provider with a lower borrowing Rate
    (bool opportunityTochange, address newProvider) = checkRates(_vault);

    if (opportunityTochange) {
      //Check how much borrowed balance along with accrued interest at current Provider
      uint256 debtposition = IVault(_vault).borrowBalance();

      if (debtposition > 0) {
        //Initiate Flash Loan
        initiateFlashLoan(
          address(_vault),
          address(newProvider),
          IVault(_vault).borrowAsset(),
          debtposition
        );
      }

      //Set the new provider in the Vault
      setProvider(_vault, address(newProvider));
      return true;
    }
    else {
      return false;
    }
  }

  /**
  * @dev Compares borrowing Rates from providers of a Vault, returns
    true on success and fuji address of the provider with best borrowing rate
  * @param _vault: fuji Vault address
  */
  function checkRates(address _vault) public view returns(bool, address) {
    //Get the array of Providers from _vault
    address[] memory arrayOfProviders = IVault(_vault).getProviders();
    address borrowingAsset = IVault(_vault).borrowAsset();
    bool opportunityTochange = false;

    //Call and check borrow rates for all Providers in array for _vault
    uint256 currentRate = IProvider(IVault(_vault).activeProvider()).getBorrowRateFor(borrowingAsset);
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

  /**
  * @dev Sets a new provider to called Vault, returns true on success
  * @param _vault: fuji Vault address to which active provider will change
  * @param _newProviderAddr: fuji address of new Provider
  */
  function setProvider(address _vault, address _newProviderAddr)internal returns(bool) {
    //Create vault instance and call setActiveProvider method in that vault.
    IVault(_vault).setActiveProvider(_newProviderAddr);
  }

  /**
  * @dev Aave Flashloan call, Refer to Aave Flashloan documentation.
  */
  function initiateFlashLoan(
    address _vaultAddr,
    address _newProviderAddr,
    address _borrowAsset,
    uint256 _amount
  ) internal isAuthorized {
     //Initialize Instance of Aave Lending Pool
     ILendingPool aaveLp = ILendingPool(LENDING_POOL);

     //Passing arguments to construct Aave flashloan -limited to 1 asset type for now.
     address receiverAddress = flasherAddr;
     address[] memory assets = new address[](1);
     assets[0] = address(_borrowAsset);
     uint256[] memory amounts = new uint256[](1);
     amounts[0] = _amount;

     // 0 = no debt, 1 = stable, 2 = variable
     uint256[] memory modes = new uint256[](1);
     modes[0] = 0;

     address onBehalfOf = address(this);
     bytes memory params = abi.encode(_vaultAddr, _newProviderAddr);
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
