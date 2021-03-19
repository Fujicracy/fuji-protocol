// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;

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

  function getCollateralAsset() external view returns(address);
  function getBorrowAsset() external view returns(address);

  function activeProvider() external view returns(address);
  function borrowBalance() external returns(uint256);
  function debtToken() external view returns(address);
	function getcollateralBalance() external view returns(uint256);
	function getUsercollateral(address _user) external view returns(uint256);
	function getNeededCollateralFor(uint256 _amount) external view returns(uint256);
	function getProviders() external view returns(address[] memory);
	function getFlasher() external view returns(address);

  function executeSwitch(address _newProvider, uint256 _debtAmount) external;
  function setActiveProvider(address _provider) external;
	function setVaultCollateralBalance(uint256 _newCollateralBalance) external;
	function setUsercollateral(address _user, uint256 _newValue) external;
  function updateDebtTokenBalances() external;
	function getLiquidationBonusFor(uint256 _amount,bool _flash) external view returns(uint256);

	function deposit(uint256 _collateralAmount) external payable;
	function withdraw(uint256 _withdrawAmount) external;
	function borrow(uint256 _borrowAmount) external;
	function payback(uint256 _repayAmount) external payable;
}
