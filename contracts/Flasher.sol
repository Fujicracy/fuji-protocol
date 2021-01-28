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
    //it contains:
    // 1. vault's address on which we should call fujiSwitch
    // 2. new provider's address which we pass on fujiSwitch

    //approve vault to spend ERC20

    //call fujiSwitch

    for (uint i = 0; i < assets.length; i++) {
      uint amountOwing = amounts[i].add(premiums[i]);
      IERC20(assets[i]).approve(address(LENDING_POOL), amountOwing);
    }

    return true;
  }
}
