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
	function collateralBalance() external view returns(uint256);
  function borrowBalance() external returns(uint256);
  function debtToken() external view returns(address);
	function getUsercollateral(address _user) external view returns(uint256);
	function getNeededCollateralFor(uint256 _amount) external view returns(uint256);
	function getProviders() external view returns(address[] memory);

  function executeSwitch(address _newProvider, uint256 _debtAmount) external;
  function setActiveProvider(address _provider) external;
	function setVaultCollateralBalance(uint256 _newCollateralBalance) external;
	function setUsercollateral(address _user, uint256 _newValue) external;
  function updateDebtTokenBalances() external;

	function _deposit(uint256 _amount,address _provider) external;
	function _withdraw(uint256 _amount,address _provider) external;
	function _borrow(uint256 _amount,address _provider) external;
	function _payback(uint256 _amount,address _provider) external;
}
