// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;

import { DebtToken } from "./DebtToken.sol";

interface IVault {

  // Log Users deposit
	event Deposit(address userAddrs, uint256 amount);
	// Log Users borrow
	event Borrow(address userAddrs, uint256 amount);
	// Log Users debt repay
	event Repay(address userAddrs, uint256 amount);
	// Log Users withdraw
	event Withdraw(address userAddrs, uint256 amount);
	// Log New active provider
	event SetActiveProvider(address providerAddr);
	// Log Switch providers
	event Switch(address fromProviderAddrs, address toProviderAddr);
	// Log Liquidation
	event Liquidate(address userAddr, address liquidator, uint256 amount);
	// Log FlashClose
	event FlashClose(address userAddr, uint256 amount);
	// Log Liquidation
	event FlashLiquidate(address userAddr, address liquidator, uint256 amount);

  function getCollateralAsset() external view returns(address);
  function getBorrowAsset() external view returns(address);

  function activeProvider() external view returns(address);
  function borrowBalance() external returns(uint256);
  function debtToken() external view returns(DebtToken);

  function executeSwitch(address _newProvider, uint256 _debtAmount) external;
  function executeFlashClose(address _userAddr, uint256 _debtAmount) external;
  function executeFlashLiquidation(address _userAddr, address _liquidatorAddr, uint256 _debtAmount) external;
  function getProviders() external view returns(address[] memory);
  function setActiveProvider(address _provider) external;
  function updateDebtTokenBalances() external;
}
