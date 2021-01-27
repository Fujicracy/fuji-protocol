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
  address constant LENDING_POOL = 0x9FE532197ad76c5a68961439604C037EB79681F0;

  IVault[] vaults;

  address owner;
  address flasherAddr;

  modifier isAuthorized() {
    require(msg.sender == owner || msg.sender == address(this), "!authorized");
    _;
  }

  constructor(
    address _owner,
    address _flasher,
    // TODO remove
    address _vault
  ) public {
    // TODO remove
    vaults.push(IVault(_vault));

    owner = _owner;
    flasherAddr = _flasher;
  }

  function addVault(address _vault) external isAuthorized {
    vaults.push(IVault(_vault));
  }

  function callFlash() public {
    IVault vault = vaults[0];

    // TODO
    //vault.unlock();

    IProvider betterProvider = vault.providers(1);

    initiateFlashLoan(
      address(vault),
      address(betterProvider),
      vault.borrowAsset(),
      vault.outstandingBalance()
    );
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
