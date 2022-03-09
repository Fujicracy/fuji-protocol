// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./VoucherCore.sol";

contract PreTokenBonds is VoucherCore {
  function _initialize(
      string memory _name,
      string memory _symbol,
      uint8 _unitDecimals
  ) internal override {
    VoucherCore._initialize(_name, _symbol, _unitDecimals);
  }

  
}