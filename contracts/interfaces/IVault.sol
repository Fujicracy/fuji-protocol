// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IVault {
  // Vault Events

  /**
   * @dev Log a deposit transaction done by a user
   */
  event Deposit(address indexed userAddrs, address indexed asset, uint256 amount);
  /**
   * @dev Log a withdraw transaction done by a user
   */
  event Withdraw(address indexed userAddrs, address indexed asset, uint256 amount);
  /**
   * @dev Log a borrow transaction done by a user
   */
  event Borrow(address indexed userAddrs, address indexed asset, uint256 amount);
  /**
   * @dev Log a payback transaction done by a user
   */
  event Payback(address indexed userAddrs, address indexed asset, uint256 amount);
  /**
   * @dev Log a switch from provider to new provider in vault
   */
  event Switch(
    address fromProviderAddrs,
    address toProviderAddr,
    uint256 debtamount,
    uint256 collattamount
  );
  /**
   * @dev Log a change in active provider
   */
  event SetActiveProvider(address newActiveProviderAddress);
  /**
   * @dev Log a change in the array of provider addresses
   */
  event ProvidersChanged(address[] newProviderArray);
  /**
   * @dev Log a change in F1155 address
   */
  event F1155Changed(address newF1155Address);
  /**
   * @dev Log a change in fuji admin address
   */
  event FujiAdminChanged(address newFujiAdmin);
  /**
   * @dev Log a change in the factor values
   */
  event FactorChanged(FactorType factorType, uint64 newFactorA, uint64 newFactorB);
  /**
   * @dev Log a change in the oracle address
   */
  event OracleChanged(address newOracle);

  enum FactorType {
    Safety,
    Collateralization,
    ProtocolFee,
    BonusLiquidation
  }

  struct Factor {
    uint64 a;
    uint64 b;
  }

  // Core Vault Functions

  function deposit(uint256 _collateralAmount) external payable;

  function withdraw(int256 _withdrawAmount) external;

  function withdrawLiq(int256 _withdrawAmount) external;

  function borrow(uint256 _borrowAmount) external;

  function payback(int256 _repayAmount) external payable;

  function paybackLiq(address[] memory _users, uint256 _repayAmount) external payable;

  function executeSwitch(
    address _newProvider,
    uint256 _flashLoanDebt,
    uint256 _fee
  ) external payable;

  //Getter Functions

  function activeProvider() external view returns (address);

  function borrowBalance(address _provider) external view returns (uint256);

  function depositBalance(address _provider) external view returns (uint256);

  function userDebtBalance(address _user) external view returns (uint256);

  function userProtocolFee(address _user) external view returns (uint256);

  function userDepositBalance(address _user) external view returns (uint256);

  function getNeededCollateralFor(uint256 _amount, bool _withFactors)
    external
    view
    returns (uint256);

  function getLiquidationBonusFor(uint256 _amount) external view returns (uint256);

  function getProviders() external view returns (address[] memory);

  function fujiERC1155() external view returns (address);

  //Setter Functions

  function setActiveProvider(address _provider) external;

  function updateF1155Balances() external;

  function protocolFee() external view returns (uint64, uint64);
}
