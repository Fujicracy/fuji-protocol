// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { UniERC20 } from "./LibUniERC20.sol";

abstract contract VaultBase is Ownable {

  using SafeMath for uint256;
  using UniERC20 for IERC20;

  //Managed assets in this Vault
  address public collateralAsset;
  address public borrowAsset;

  address public controller;
  address public liquidator;

  //Balance of all available collateral in ETH
  uint256 public override collateralBalance;

  modifier isAuthorized() {
    require(msg.sender == controller || msg.sender == liquidator || msg.sender == address(this) || msg.sender == owner(), "!authorized");
    _;
  }

  //Internal functions

  /**
  * @dev Executes deposit operation with delegatecall.
  * @param _amount: amount to be deposited
  * @param _provider: address of provider to be used
  */
  function _deposit(
    uint256 _amount,
    address _provider
  ) external override isAuthorized {
    bytes memory data = abi.encodeWithSignature(
      "deposit(address,uint256)",
      collateralAsset,
      _amount
    );
    _execute(_provider, data);
  }

  /**
  * @dev Executes withdraw operation with delegatecall.
  * @param _amount: amount to be withdrawn
  * @param _provider: address of provider to be used
  */
  function _withdraw(
    uint256 _amount,
    address _provider
  ) external override isAuthorized{
    bytes memory data = abi.encodeWithSignature(
      "withdraw(address,uint256)",
      collateralAsset,
      _amount
    );
    _execute(_provider, data);
  }

  /**
  * @dev Executes borrow operation with delegatecall.
  * @param _amount: amount to be borrowed
  * @param _provider: address of provider to be used
  */
  function _borrow(
    uint256 _amount,
    address _provider
  ) external override isAuthorized {
    bytes memory data = abi.encodeWithSignature(
      "borrow(address,uint256)",
      borrowAsset,
      _amount
    );
    _execute(_provider, data);
  }

  /**
  * @dev Executes payback operation with delegatecall.
  * @param _amount: amount to be paid back
  * @param _provider: address of provider to be used
  */
  function _payback(
    uint256 _amount,
    address _provider
  ) external override isAuthorized{
    bytes memory data = abi.encodeWithSignature(
      "payback(address,uint256)",
      borrowAsset,
      _amount
    );
    _execute(_provider, data);
  }

  /**
  * @dev Sets new value for the collateral balance
  * @param _newCollateralBalance: amount to be paid back
  */
  function setVaultCollateralBalance(uint256 _newCollateralBalance) external override isAuthorized {
    collateralBalance = _newCollateralBalance;
  }


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
