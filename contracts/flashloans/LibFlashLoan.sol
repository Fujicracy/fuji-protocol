// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.5;

library FlashLoan {
  enum CallType { Switch, SelfLiquidate, Liquidate }
  struct Info {
    CallType callType;
    address vault;
    address other;
    address asset;
    uint256 amount;
    uint256 premium;
  }
}

