// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";

import "../interfaces/IFujiAdmin.sol";
import "../interfaces/ISwapper.sol";

/**
 * @dev Contract to support Harvesting function in {FujiVault}
 */

contract SwapperMATIC is ISwapper {
  address public constant MATIC = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
  address public constant WMATIC = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
  address public constant QUICKSWAP_ROUTER_ADDR = 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff;

  /**
   * @dev Returns data structure to perform a swap transaction.
   * Function is called by FujiVault to harvest farmed tokens at baselayer protocols
   * @param assetFrom: asset type to be swapped.
   * @param assetTo: desired asset after swap transaction.
   * @param amount: amount of assetFrom to be swapped.
   * Requirements:
   * - Should return transaction data to swap all farmed token to vault's collateral type.
   */
  function getSwapTransaction(
    address assetFrom,
    address assetTo,
    uint256 amount
  ) external view override returns (Transaction memory transaction) {
    require(assetFrom != assetTo, "invalid request");

    if (assetFrom == MATIC && assetTo == WMATIC) {
      transaction.to = WMATIC;
      transaction.value = amount;
      transaction.data = abi.encodeWithSelector(IWETH.deposit.selector);
    } else if (assetFrom == WMATIC && assetTo == MATIC) {
      transaction.to = WMATIC;
      transaction.data = abi.encodeWithSelector(IWETH.withdraw.selector, amount);
    } else if (assetFrom == MATIC) {
      transaction.to = QUICKSWAP_ROUTER_ADDR;
      address[] memory path = new address[](2);
      path[0] = WMATIC;
      path[1] = assetTo;
      transaction.value = amount;
      transaction.data = abi.encodeWithSelector(
        IUniswapV2Router01.swapExactETHForTokens.selector,
        0,
        path,
        msg.sender,
        type(uint256).max
      );
    } else if (assetTo == MATIC) {
      transaction.to = QUICKSWAP_ROUTER_ADDR;
      address[] memory path = new address[](2);
      path[0] = assetFrom;
      path[1] = WMATIC;
      transaction.data = abi.encodeWithSelector(
        IUniswapV2Router01.swapExactTokensForETH.selector,
        amount,
        0,
        path,
        msg.sender,
        type(uint256).max
      );
    } else if (assetFrom == WMATIC || assetTo == WMATIC) {
      transaction.to = QUICKSWAP_ROUTER_ADDR;
      address[] memory path = new address[](2);
      path[0] = assetFrom;
      path[1] = assetTo;
      transaction.data = abi.encodeWithSelector(
        IUniswapV2Router01.swapExactTokensForTokens.selector,
        amount,
        0,
        path,
        msg.sender,
        type(uint256).max
      );
    } else {
      transaction.to = QUICKSWAP_ROUTER_ADDR;
      address[] memory path = new address[](3);
      path[0] = assetFrom;
      path[1] = WMATIC;
      path[2] = assetTo;
      transaction.data = abi.encodeWithSelector(
        IUniswapV2Router01.swapExactTokensForTokens.selector,
        amount,
        0,
        path,
        msg.sender,
        type(uint256).max
      );
    }
  }
}
