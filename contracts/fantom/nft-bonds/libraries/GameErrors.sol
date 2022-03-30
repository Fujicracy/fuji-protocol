// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library GameErrors {
  string public constant NOT_AUTH = "G00";
  string public constant WRONG_PHASE = "G01";
  string public constant INVALID_INPUT = "G02";
  string public constant VALUE_NOT_SET = "G03";
  string public constant USER_LOCK_ERROR = "G04";
  string public constant NOT_ENOUGH_AMOUNT = "G05";
  string public constant NOT_TRANSFERABLE = "G06";
}