// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IFujiAdmin.sol";
import "../interfaces/IHarvester.sol";
import "../libraries/Errors.sol";

contract VaultHarvesterFTM is IHarvester {
  /**
   * @dev Called by the Vault to harvest farmed tokens at baselayer Protocols
   * @param _farmProtocolNum: Number assigned to Protocol for farming
   */
  function getHarvestTransaction(uint256 _farmProtocolNum, bytes memory _data)
    external
    view
    override
    returns (address claimedToken, Transaction memory transaction)
  {
    if (_farmProtocolNum == 0) {
      return _getGeistTransaction(_data);
    } else {
      revert(Errors.VL_INVALID_HARVEST_PROTOCOL_NUMBER);
    }
  }

  function _getGeistTransaction(bytes memory _data)
    internal
    view
    returns (address claimedToken, Transaction memory transaction)
  {
    uint256 harvestType = abi.decode(_data, (uint256));
    if (harvestType == 0) {
      // claim vested GEIST
      // assets are all gTokens and variableDebtTokens
      // "to": ChefIncentivesController
      (, address[] memory assets) = abi.decode(_data, (uint256, address[]));
      transaction.to = 0x297FddC5c33Ef988dd03bd13e162aE084ea1fE57;
      transaction.data = abi.encodeWithSelector(
        bytes4(keccak256("claim(address,address[])")),
        msg.sender,
        assets
      );
    } else if (harvestType == 1) {
      // get gTokens
      // "to": Geist Staking Contract
      transaction.to = 0x49c93a95dbcc9A6A4D8f77E59c038ce5020e82f8;
      transaction.data = abi.encodeWithSelector(
        bytes4(keccak256("getReward()"))
      );
    } else if (harvestType == 2) {
      (, address asset) = abi.decode(_data, (uint256, address));
      // withdraw gToken
      // "to": Geist Lending Pool
      transaction.to = 0x9FAD24f572045c7869117160A571B2e50b10d068;
      transaction.data = abi.encodeWithSelector(
        bytes4(keccak256("withdraw(address,uint256,address)")),
        asset,
        type(uint256).max,
        msg.sender
      );
      claimedToken = asset;
    } else if (harvestType == 3) {
      (, uint256 amount) = abi.decode(_data, (uint256, uint256));
      // withdraw GEIST
      // "to": Geist Staking Contract
      transaction.to = 0x49c93a95dbcc9A6A4D8f77E59c038ce5020e82f8;
      transaction.data = abi.encodeWithSelector(
        bytes4(keccak256("withdraw(uint256)")),
        amount
      );
      // GEIST
      claimedToken = 0xd8321AA83Fb0a4ECd6348D4577431310A6E0814d;
    } else {
      revert(Errors.VL_INVALID_HARVEST_TYPE);
    }
  }
}
