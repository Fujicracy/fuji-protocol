// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IDebtToken {

  /**
   * @dev Mints debt token to the `onBehalfOf` address
   * @param user The address receiving the borrowed underlying, being the delegatee in case
   * of credit delegate, or same as `onBehalfOf` otherwise
   * @param onBehalfOf The address receiving the debt tokens
   * @param amount The amount of debt being minted
   * @return `true` if the the previous balance of the user is 0
   **/
  function mint(address user,address onBehalfOf,uint256 amount) external returns (bool);

  /**
   * @dev Burns user variable debt
   * @param user The user which debt is burnt
   **/
  function burn(address user,uint256 amount) external;


  /**
   * @dev Updates liquidityIndex on debt changes
   **/
  function updateState(uint256 newBalance) external;

  /**
   * @dev Calculates the accumulated debt balance of the user
   * @return The debt balance of the user
   **/
  function balanceOf(address user) external view returns (uint256);


}
