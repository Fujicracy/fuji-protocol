// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./abstracts/claimable/Claimable.sol";
import "./interfaces/IFlasher.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IVaultControl.sol";
import "./interfaces/IProvider.sol";
import "./interfaces/IFujiAdmin.sol";
import "./libraries/FlashLoans.sol";
import "./libraries/Errors.sol";

/**
 * @dev Contract that controls rebalances and refinancing of the positions
 * held by the FujiVaults.
 *
 */

contract Controller is Claimable {

  // Controller Events

  /**
  * @dev Log a change in fuji admin address
  */
  event FujiAdminChanged(address newFujiAdmin);
  /**
  * @dev Log a change in executor permission
  */
  event ExecutorPermitChanged(address executorAddress, bool newPermit);


  IFujiAdmin private _fujiAdmin;

  mapping(address => bool) public isExecutor;

  /**
  * @dev Throws if address passed is not a recognized vault.
  */
  modifier isValidVault(address _vaultAddr) {
    require(_fujiAdmin.validVault(_vaultAddr), "Invalid vault!");
    _;
  }

  /**
  * @dev Throws if caller passed is not owner or approved executor.
  */
  modifier onlyOwnerOrExecutor() {
    require(msg.sender == owner() || isExecutor[msg.sender], "Not executor!");
    _;
  }

  /**
   * @dev Sets the fujiAdmin Address
   * @param _newFujiAdmin: FujiAdmin Contract Address
   */
  function setFujiAdmin(address _newFujiAdmin) external onlyOwner {
    require(_newFujiAdmin != address(0), Errors.VL_ZERO_ADDR);
    _fujiAdmin = IFujiAdmin(_newFujiAdmin);
    emit FujiAdminChanged(_newFujiAdmin);
  }

  /**
   * @dev Performs a forced refinancing routine
   * @param _vaultAddr: fuji Vault address
   * @param _newProvider: new provider address
   * @param _ratioA: ratio to determine how much of debt position to move
   * @param _ratioB:
   * @param _flashNum: integer identifier of flashloan provider
   * Requirements:
   * - '_ratioA' and '_ratioB' should be non-zero values.
   * - '_ratioA' should be <= than '_ratioB', such that: (_ratioA / _ratioB) <= 1
   */
  function doRefinancing(
    address _vaultAddr,
    address _newProvider,
    uint256 _ratioA,
    uint256 _ratioB,
    uint8 _flashNum
  ) external isValidVault(_vaultAddr) onlyOwnerOrExecutor {

    IVault vault = IVault(_vaultAddr);

    // Validate ratio inputs
    require(
      _ratioA > 0 &&
      _ratioB > 0 &&
      _ratioB >= _ratioA,
      Errors.RF_INVALID_RATIO_VALUES
    );

    // Validate _newProvider is not equal to vault's activeProvider
    require(
      vault.activeProvider() != _newProvider,
      Errors.RF_INVALID_NEW_ACTIVEPROVIDER
    );


    IVaultControl.VaultAssets memory vAssets = IVaultControl(_vaultAddr).vAssets();
    vault.updateF1155Balances();

    // Check Vault borrowbalance and apply ratio (consider compound or not)
    uint256 debtPosition = IProvider(vault.activeProvider()).getBorrowBalanceOf(
      vAssets.borrowAsset,
      _vaultAddr
    );
    uint256 applyRatiodebtPosition = (debtPosition * _ratioA) / _ratioB;

    // Check vault Balance at 'activeProvider' and applied ratio computation
    require(
      debtPosition >= applyRatiodebtPosition &&
      applyRatiodebtPosition > 0,
      Errors.RF_INVALID_RATIO_VALUES
    );

    //Initiate Flash Loan Struct
    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.Switch,
      asset: vAssets.borrowAsset,
      amount: applyRatiodebtPosition,
      vault: _vaultAddr,
      newProvider: _newProvider,
      userAddrs: new address[](0),
      userBalances: new uint256[](0),
      userliquidator: address(0),
      fliquidator: address(0)
    });

    IFlasher(payable(_fujiAdmin.getFlasher())).initiateFlashloan(info, _flashNum);

    IVault(_vaultAddr).setActiveProvider(_newProvider);
  }

  /**
   * @dev Sets approved executors for 'doRefinancing' function
   * Can only be called by the contract owner.
   * Emits a {ExecutorPermitChanged} event.
   */
  function setExecutors(address[] calldata _executors, bool _isExecutor) external onlyOwner {
    for (uint256 i = 0; i < _executors.length; i++) {
      require(_executors[i] != address(0), Errors.VL_ZERO_ADDR);
      isExecutor[_executors[i]] = _isExecutor;
      emit ExecutorPermitChanged(_executors[i], _isExecutor);
    }
  }
}
