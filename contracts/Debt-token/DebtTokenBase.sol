// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {VersionedInitializable} from './VersionedInitializable.sol';
import {IncentivizedERC20} from './IncentivizedERC20.sol';
import {Errors} from './Errors.sol';

/**
 * @title DebtTokenBase
 * @notice Base contract for different types of debt tokens, like StableDebtToken or VariableDebtToken
 * @author Inspired by Aave adapted for Fuji
 */

abstract contract DebtTokenBase is IncentivizedERC20, VersionedInitializable {

  address public immutable UNDERLYING_ASSET_ADDRESS;
  address public immutable VAULT;
  address public fliquidator;

  /**
   * @dev Only vault and fliquidator can call functions marked by this modifier
   **/
  modifier onlyVault {
    require(
      _msgSender() == VAULT ||
      _msgSender() == fliquidator
    , Errors.VLT_CALLER_MUST_BE_VAULT);
    _;
  }

  /**
   * @dev The metadata of the token will be set on the proxy, that the reason of
   * passing "NULL" and 0 as metadata
   */
  constructor(
    address _vault,
    address _fliquidator,
    address underlyingAssetAddress,
    string memory name,
    string memory symbol
  ) public IncentivizedERC20(name, symbol, 18) {
    VAULT = _vault;
    UNDERLYING_ASSET_ADDRESS = underlyingAssetAddress;
    fliquidator =_fliquidator;
  }

  /**
   * @dev Initializes the debt token.
   * @param name The name of the token
   * @param symbol The symbol of the token
   * @param decimals The decimals of the token
   */
  function initialize(
    uint8 decimals,
    string memory name,
    string memory symbol
  ) public initializer {
    _setName(name);
    _setSymbol(symbol);
    _setDecimals(decimals);
  }

  /**
   * @dev Being non transferrable, the debt token does not implement any of the
   * standard ERC20 functions for transfer and allowance.
   **/
  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    recipient;
    amount;
    revert('TRANSFER_NOT_SUPPORTED');
  }

  function allowance(address owner, address spender)
    public
    view
    virtual
    override
    returns (uint256)
  {
    owner;
    spender;
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    spender;
    amount;
    revert('APPROVAL_NOT_SUPPORTED');
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override returns (bool) {
    sender;
    recipient;
    amount;
    revert('TRANSFER_NOT_SUPPORTED');
  }

  function increaseAllowance(address spender, uint256 addedValue)
    public
    virtual
    override
    returns (bool)
  {
    spender;
    addedValue;
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  function decreaseAllowance(address spender, uint256 subtractedValue)
    public
    virtual
    override
    returns (bool)
  {
    spender;
    subtractedValue;
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

}
