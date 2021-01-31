// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.5;
pragma experimental ABIEncoderV2;

import "./LibUniERC20.sol";
import "./VaultETHDAI.sol";

interface IFlashLoanReceiver {
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external returns (bool);
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

    //Decoding Parameters
    // 1. vault's address on which we should call fujiSwitch
    // 2. new provider's address which we pass on fujiSwitch
    (address theVault, address newProvider) = abi.decode(params, (address,address));

    //approve vault to spend ERC20
    IERC20(assets[0]).approve(address(theVault), amounts[0]);

    //Estimate flashloan payback + premium fee,
    uint amountOwing = amounts[0].add(premiums[0]);

    //call fujiSwitch
    IVault(theVault).fujiSwitch(newProvider, amountOwing);

    //Approve aaveLP to spend to repay flashloan
    IERC20(assets[0]).approve(address(LENDING_POOL), amountOwing);

    return true;
  }

  receive() external payable {}

}
