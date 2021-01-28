// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;

import "./LibUniERC20.sol";

interface IFlashLoanReceiver {
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external returns (bool);
}

interface Ivault{
  function fujiSwitch(address _newProvider) external payable;
}

contract Flasher is IFlashLoanReceiver {
  using SafeMath for uint256;

  address constant LENDING_POOL = 0x9FE532197ad76c5a68961439604C037EB79681F0;

  //This Operation is called and required by Aave FlashLoan
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external override returns (bool) {

    //decode params
    //Contain:
    // 1. vault's address on which we should call fujiSwitch
    // 2. new provider's address which we pass on fujiSwitch
    (address theVault, address newProvider) = abi.decode(params, (address,address));

    //approve vault to spend ERC20
    IERC20(assets[0]).approve(address(THE_VAULT), amounts[0]);

    //call fujiSwitch
    Ivault(theVault).fujiSwitch(newProvider);

    //Estimate flashloan payback + premium fee, and approve aaveLP to spend
    uint amountOwing = amounts[0].add(premiums[0]);
    IERC20(assets[0]).approve(address(LENDING_POOL), amountOwing);

    return true;
  }
}
