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

interface Ivault {
  function setActiveProvider(address _provider) external;
  function providers() external view returns(IProvider[] memory);
  function activeProvider() external view returns(IProvider);
  function borrowAsset() external view returns(address);
  function outstandingBalance() external view returns(uint256);
}

contract Controller {

  address private owner;
  address flasherAddr;
  address constant LENDING_POOL = 0x9FE532197ad76c5a68961439604C037EB79681F0;
  //Change Threshold is the minimum percent in Borrowing Rates to trigger a provider change
  //Percentage Expressed in ray (1e27)
  uint256 public changeThreshold;

  //State variables to control vault providers
  IVault[] vaults;
  mapping (Ivault => bool) public VaultIsIncluded;

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
  function addVault(address _vault) public isAuthorized {
    vaults.push(IVault(_vault));
    VaultIsIncluded[IVault(_vault)]=true;
  }

  function setChangeThreshold(uint256 newThreshold) public isAuthorized {
    //Input should be decimal percentage-change in ray (decimal x 1e27)
    changeThreshold = newThreshold;
  }

  function setflasher(address newflasher) public isAuthorized {
    //Check if vault is already adde
    flasherAddr = newflasher;
  }

  //Controller Core functions

  function doControllerRoutine(address _vault) public returns(bool) {
    //Check if there is an opportunity to Change provider with a lower borrowing Rate
    (bool opportunityTochange, IProvider newProvider) = checkRates(_vault);
    require(opportunityTochange, "There is no Better Borrowing Rate Provider at the time");

    //Initiate Flash Loan
    initiateFlashLoan(address(_vault), address(newProvider), IVault(_vault).borrowAsset(), IVault(_vault).outstandingBalance());

    //Set the new provider in the Vault
    setProvider(_vault, address(newProvider));
  }

  function checkRates(address _vault) public returns(bool, IProvider) {

    //Get the array of Providers from _vault
    IProvider[] memory arrayOfProviders = IVault(_vault).providers();
    address borrowingAsset = IVault(_vault).borrowAsset();
    bool opportunityTochange = false;

    //Call and check borrow rates for all Providers in array for _vault
    uint256 currentRate = (IVault(_vault).activeProvider()).getBorrowRateFor(borrowingAsset);
    uint256 differance;
    IProvider newProvider;

    for(uint i=0; i<arrayOfProviders.lenght;i++) {
      differance = (currentRate >= arrayOfProviders[i].getBorrowRateFor(borrowingAsset) ?
      currentRate - arrayOfProviders[i].getBorrowRateFor(borrowingAsset) :
      arrayOfProviders[i].getBorrowRateFor(borrowingAsset) - currentRate);
      if(differance >= changeThreshold && arrayOfProviders[i].getBorrowRateFor(borrowingAsset) < currentRate){
        currentRate = arrayOfProviders[i].getBorrowRateFor(borrowingAsset);
        newProvider = arrayOfProviders[i];
        opportunityTochange = true;
      }
    }
    //Returns success, and the Iprovider with lower borrow rate
    return (opportunityTochange, newProvider);
  }

  function setProvider(address _vault, address _newProviderAddr)internal returns(bool) {
    //Create vault instance and call setActiveProvider method in that vault.
    IVault(_vault).setActiveProvider(_newProviderAddr);
  }

  function initiateFlashLoan(
    address _vaultAddr,
    address _newProviderAddr,
    address _borrowAsset,
    uint256 _amount
  ) public isAuthorized {
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
