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

contract Liquidator is IFlashLoanReceiver {

  using SafeMath for uint256;

  address constant LENDING_POOL = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;

  /**
  * @dev Executes Aave Flashloan, this Operation is required and called by
    Aaveflashloan, refer to Aave Flasloan Documentation
  */
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external override returns (bool) {
    initiator;

    //Decoding Parameters
    // 1. vault's address on which we should call selfLiquidate
    // 2. user's address
    (address theVault, address userAddr) = abi.decode(params, (address,address));

    //approve vault to spend ERC20
    IERC20(assets[0]).approve(address(theVault), amounts[0]);

    //Estimate flashloan payback + premium fee,
    uint amountOwing = amounts[0].add(premiums[0]);

    //call fujiSwitch
    IVault(theVault).selfLiquidate(userAddr, amountOwing);

    //Approve aaveLP to spend to repay flashloan
    IERC20(assets[0]).approve(address(LENDING_POOL), amountOwing);

    return true;
  }

  receive() external payable {}

}
