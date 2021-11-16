// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICrComptroller {
  function isMarketListed(address cTokenAddress) external view returns (bool);
}
