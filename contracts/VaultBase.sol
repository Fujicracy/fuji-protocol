// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { UniERC20 } from "./LibUniERC20.sol";

abstract contract VaultBase {

  using SafeMath for uint256;
  using UniERC20 for IERC20;

  //Managed assets in this Vault
  address public collateralAsset;
  address public borrowAsset;

  address public controller;
  address public owner;

  //Balance of all available collateral in ETH
  uint256 public collateralBalance;

  modifier isAuthorized() {
    require(msg.sender == controller || msg.sender == address(this) || msg.sender == owner, "!authorized");
    _;
  }

  //Internal functions

  /**
  * @dev Returns byte response of delegatcalls
  */
  function _execute(
    address _target,
    bytes memory _data
  ) internal returns (bytes memory response) {
    assembly {
      let succeeded := delegatecall(sub(gas(), 5000), _target, add(_data, 0x20), mload(_data), 0, 0)
      let size := returndatasize()

      response := mload(0x40)
      mstore(0x40, add(response, and(add(add(size, 0x20), 0x1f), not(0x1f))))
      mstore(response, size)
      returndatacopy(add(response, 0x20), 0, size)

      switch iszero(succeeded)
      case 1 {
        // throw if delegatecall failed
        revert(add(response, 0x20), size)
      }
    }
  }
}
