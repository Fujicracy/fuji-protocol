// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./abstracts/claimable/Claimable.sol";
import "./interfaces/chainlink/AggregatorV3Interface.sol";
import "./interfaces/IFujiOracle.sol";
import "./libraries/Errors.sol";

/**
 * @dev Contract that returns and computes prices for the Fuji protocol
 */

contract FujiOracle is IFujiOracle, Claimable {
  // mapping from asset address to its price feed oracle in USD - decimals: 8
  mapping(address => address) public usdPriceFeeds;

  /**
   * @dev Initializes the contract setting '_priceFeeds' addresses for '_assets'
   */
  constructor(address[] memory _assets, address[] memory _priceFeeds) Claimable() {
    require(_assets.length == _priceFeeds.length, Errors.ORACLE_INVALID_LENGTH);
    for (uint256 i = 0; i < _assets.length; i++) {
      usdPriceFeeds[_assets[i]] = _priceFeeds[i];
    }
  }

  /**
   * @dev Sets '_priceFeed' address for a '_asset'.
   * Can only be called by the contract owner.
   * Emits a {AssetPriceFeedChanged} event.
   */
  function setPriceFeed(address _asset, address _priceFeed) public onlyOwner {
    require(_priceFeed != address(0), Errors.VL_ZERO_ADDR);
    usdPriceFeeds[_asset] = _priceFeed;
    emit AssetPriceFeedChanged(_asset, _priceFeed);
  }

  /**
   * @dev Calculates the exchange rate between two assets, with price oracle given in specified decimals.
   *      Format is: (_borrowAsset / _collateralAsset Exchange Rate).
   * @param _collateralAsset: the collateral asset, zero-address for USD.
   * @param _borrowAsset: the borrow asset, zero-address for USD.
   * @param _decimals: the decimals of the price output.
   * Returns the exchange rate of the given assets pair.
   */
  function getPriceOf(
    address _collateralAsset,
    address _borrowAsset,
    uint8 _decimals
  ) external view override returns (uint256 price) {
    price = 10**uint256(_decimals);

    if (_borrowAsset != address(0)) {
      price = price * _getUSDPrice(_borrowAsset);
    } else {
      price = price * (10**8);
    }

    if (_collateralAsset != address(0)) {
      price = price / _getUSDPrice(_collateralAsset);
    } else {
      price = price / (10**8);
    }
  }

  /**
   * @dev Calculates the USD price of asset.
   * @param _asset: the asset address.
   * Returns the USD price of the given asset
   */
  function _getUSDPrice(address _asset) internal view returns (uint256 price) {
    require(usdPriceFeeds[_asset] != address(0), Errors.ORACLE_NONE_PRICE_FEED);

    (, int256 latestPrice, , , ) = AggregatorV3Interface(usdPriceFeeds[_asset]).latestRoundData();

    price = uint256(latestPrice);
  }
}
