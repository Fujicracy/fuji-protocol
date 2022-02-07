// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IFujiAdmin {
  // FujiAdmin Events

  /**
   * @dev Log change of flasher address
   */
  event FlasherChanged(address newFlasher);
  /**
   * @dev Log change of fliquidator address
   */
  event FliquidatorChanged(address newFliquidator);
  /**
   * @dev Log change of treasury address
   */
  event TreasuryChanged(address newTreasury);
  /**
   * @dev Log change of controller address
   */
  event ControllerChanged(address newController);
  /**
   * @dev Log change of vault harvester address
   */
  event VaultHarvesterChanged(address newHarvester);
  /**
   * @dev Log change of swapper address
   */
  event SwapperChanged(address newSwapper);
  /**
   * @dev Log change of vault address permission
   */
  event VaultPermitChanged(address vaultAddress, bool newPermit);

  function validVault(address _vaultAddr) external view returns (bool);

  function getFlasher() external view returns (address);

  function getFliquidator() external view returns (address);

  function getController() external view returns (address);

  function getTreasury() external view returns (address payable);

  function getVaultHarvester() external view returns (address);

  function getSwapper() external view returns (address);
}
