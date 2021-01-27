// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;

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

  //This Operation is called and required by Aave FlashLoan
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external override returns (bool) {

    //TODO
    //

    return true;
  }
}
