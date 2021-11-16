// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";

import "../interfaces/IFujiAdmin.sol";
import "../interfaces/ISwapper.sol";

/**
 * @dev Contract to support Harvesting function in {FujiVault}
 */

contract SwapperFTM is ISwapper {
  address public constant FTM = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
  address public constant WFTM = 0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83;
  address public constant SPOOKY_ROUTER_ADDR = 0xF491e7B69E4244ad4002BC14e878a34207E38c29;

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

    if (assetFrom == FTM && assetTo == WFTM) {
      transaction.to = WFTM;
      transaction.value = amount;
      transaction.data = abi.encodeWithSelector(IWETH.deposit.selector);
    } else if (assetFrom == WFTM && assetTo == FTM) {
      transaction.to = WFTM;
      transaction.data = abi.encodeWithSelector(IWETH.withdraw.selector, amount);
    } else if (assetFrom == FTM) {
      transaction.to = SPOOKY_ROUTER_ADDR;
      address[] memory path = new address[](2);
      path[0] = WFTM;
      path[1] = assetTo;
      transaction.value = amount;
      transaction.data = abi.encodeWithSelector(
        IUniswapV2Router01.swapExactETHForTokens.selector,
        0,
        path,
        msg.sender,
        type(uint256).max
      );
    } else if (assetTo == FTM) {
      transaction.to = SPOOKY_ROUTER_ADDR;
      address[] memory path = new address[](2);
      path[0] = assetFrom;
      path[1] = WFTM;
      transaction.data = abi.encodeWithSelector(
        IUniswapV2Router01.swapExactTokensForETH.selector,
        amount,
        0,
        path,
        msg.sender,
        type(uint256).max
      );
    } else if (assetFrom == WFTM || assetTo == WFTM) {
      transaction.to = SPOOKY_ROUTER_ADDR;
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
      transaction.to = SPOOKY_ROUTER_ADDR;
      address[] memory path = new address[](3);
      path[0] = assetFrom;
      path[1] = WFTM;
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
