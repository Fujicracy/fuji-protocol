// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IDebtToken} from './IDebtToken.sol';
import {WadRayMath} from './Debt-token/WadRayMath.sol';
import {Errors} from './Debt-token/Errors.sol';
import {DebtTokenBase} from './Debt-token/DebtTokenBase.sol';

/**
 * @title DebtToken - Variable
 * @notice Implements a variable debt token to track the borrowing positions of users
 * at variable rate mode
 * @author Inspired by Aave adapted to Fuji
 **/
contract DebtToken is DebtTokenBase {

  using WadRayMath for uint256;

  uint256 public constant DEBT_TOKEN_REVISION = 0x1;

  uint256 liquidityIndex;

  constructor(
    address vault,
    address underlyingAsset,
    string memory name,
    string memory symbol

  ) public DebtTokenBase(vault, underlyingAsset, name, symbol) {

    liquidityIndex = uint128(WadRayMath.ray());
  }

  /**
   * @dev Updates liquidityIndex on debt changes
   **/
  function updateState(uint256 newBalance) external onlyVault {
    uint256 total = totalSupply();

    if (newBalance > 0 && total > 0) {
      uint256 diff = newBalance.sub(total);
      uint256 amountToLiquidityRatio = diff.wadToRay().rayDiv(total.wadToRay());

      uint256 result = amountToLiquidityRatio.add(WadRayMath.ray());

      result = result.rayMul(liquidityIndex);
      require(result <= type(uint128).max, Errors.VL_LIQUIDITY_INDEX_OVERFLOW);

      liquidityIndex = uint128(result);
    }
  }

  /**
   * @dev Gets the revision of the stable debt token implementation
   * @return The debt token implementation revision
   **/
  function getRevision() internal pure virtual override returns (uint256) {
    return DEBT_TOKEN_REVISION;
  }

  /**
   * @dev Calculates the accumulated debt balance of the user
   * @return The debt balance of the user
   **/
  function balanceOf(address user) public view virtual override returns (uint256) {
    uint256 scaledBalance = super.balanceOf(user);

    if (scaledBalance == 0) {
      return 0;
    }

    return scaledBalance.rayMul(liquidityIndex);
  }

  /**
   * @dev Mints debt token to the `onBehalfOf` address
   * -  Only callable by the LendingPool
   * @param user The address receiving the borrowed underlying, being the delegatee in case
   * of credit delegate, or same as `onBehalfOf` otherwise
   * @param onBehalfOf The address receiving the debt tokens
   * @param amount The amount of debt being minted
   * @return `true` if the the previous balance of the user is 0
   **/
  function mint(address user, address onBehalfOf, uint256 amount) external onlyVault returns (bool) {

    uint256 previousBalance = super.balanceOf(onBehalfOf);
    uint256 amountScaled = amount.rayDiv(liquidityIndex);
    require(amountScaled != 0, Errors.VL_INVALID_MINT_AMOUNT);

    _mint(onBehalfOf, amountScaled);

    emit Transfer(address(0), onBehalfOf, amount);
    emit Mint(user, onBehalfOf, amount, liquidityIndex);

    return previousBalance == 0;
  }

  /**
   * @dev Burns user variable debt
   * - Only callable by the LendingPool
   * @param user The user whose debt is getting burned
   * @param amount The amount getting burned
   **/
  function burn(address user, uint256 amount) external  onlyVault {
    uint256 amountScaled = amount.rayDiv(liquidityIndex);
    require(amountScaled != 0, Errors.VL_INVALID_BURN_AMOUNT);

    _burn(user, amountScaled);

    emit Transfer(user, address(0), amount);
    emit Burn(user, amount, liquidityIndex);
  }

  /**
   * @dev Returns the principal debt balance of the user from
   * @return The debt balance of the user since the last burn/mint action
   **/
  function scaledBalanceOf(address user) public view virtual returns (uint256) {
    return super.balanceOf(user);
  }

  /**
   * @dev Returns the total supply of the variable debt token. Represents the total debt accrued by the users
   * @return The total supply
   **/
  function totalSupply() public view virtual override returns (uint256) {
    return super.totalSupply();
  }

  /**
   * @dev Returns the scaled total supply of the variable debt token. Represents sum(debt/index)
   * @return the scaled total supply
   **/
  function scaledTotalSupply() public view virtual returns (uint256) {
    return super.totalSupply();
  }

  /**
   * @dev Returns the principal balance of the user and principal total supply.
   * @param user The address of the user
   * @return The principal balance of the user
   * @return The principal total supply
   **/
  function getScaledUserBalanceAndSupply(address user) external view returns (uint256, uint256)
  {
    return (super.balanceOf(user), super.totalSupply());
  }

  /**
   * @dev Emitted after the mint action
   * @param from The address performing the mint
   * @param onBehalfOf The address of the user on which behalf minting has been performed
   * @param value The amount to be minted
   * @param index The last index of the reserve
   **/
  event Mint(address indexed from, address indexed onBehalfOf, uint256 value, uint256 index);

  /**
   * @dev Emitted when variable debt is burnt
   * @param user The user which debt has been burned
   * @param amount The amount of debt being burned
   * @param index The index of the user
   **/
  event Burn(address indexed user, uint256 amount, uint256 index);


}
