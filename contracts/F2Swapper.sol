// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";

import "./interfaces/IFujiAdmin.sol";
import "./interfaces/ISwapper.sol";

/**
 * @dev Contract to support Harvesting function in {FujiVault}
 */

contract F2Swapper is ISwapper {
  address public constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
  address public immutable wNative;
  address public immutable router;

  /**
  * @dev Sets the wNative and router addresses
  */
  constructor(address _wNative, address _router) {
    wNative = _wNative;
    router = _router;
  }

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

    if (assetFrom == NATIVE && assetTo == wNative) {
      transaction.to = wNative;
      transaction.value = amount;
      transaction.data = abi.encodeWithSelector(IWETH.deposit.selector);
    } else if (assetFrom == wNative && assetTo == NATIVE) {
      transaction.to = wNative;
      transaction.data = abi.encodeWithSelector(IWETH.withdraw.selector, amount);
    } else if (assetFrom == NATIVE) {
      transaction.to = router;
      address[] memory path = new address[](2);
      path[0] = wNative;
      path[1] = assetTo;
      transaction.value = amount;
      transaction.data = abi.encodeWithSelector(
        IUniswapV2Router01.swapExactETHForTokens.selector,
        0,
        path,
        msg.sender,
        type(uint256).max
      );
    } else if (assetTo == NATIVE) {
      transaction.to = router;
      address[] memory path = new address[](2);
      path[0] = assetFrom;
      path[1] = wNative;
      transaction.data = abi.encodeWithSelector(
        IUniswapV2Router01.swapExactTokensForETH.selector,
        amount,
        0,
        path,
        msg.sender,
        type(uint256).max
      );
    } else if (assetFrom == wNative || assetTo == wNative) {
      transaction.to = router;
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
      transaction.to = router;
      address[] memory path = new address[](3);
      path[0] = assetFrom;
      path[1] = wNative;
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
