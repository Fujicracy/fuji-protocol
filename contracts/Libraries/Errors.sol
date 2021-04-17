// SPDX-License-Identifier: agpl-3.0
pragma solidity <0.8.0;

/**
 * @title Errors library
 * @author Fuji
 * @notice Defines the error messages emitted by the different contracts of the Aave protocol
 * @dev Error messages prefix glossary:
 *  - VL = Validation Logic 100 series
 *  - MATH = Math libraries 200 series
 *  - RF = Refinancing 300 series
 *  - VLT = vault 400 series
 *  - SP = Special 900 series
 */
library Errors {

  //Errors
  string public constant VL_INDEX_OVERFLOW = '100'; // index overflows uint128
  string public constant VL_INVALID_MINT_AMOUNT = '101'; //invalid amount to mint
  string public constant VL_INVALID_BURN_AMOUNT = '102'; //invalid amount to burn
  string public constant VL_AMOUNT_ERROR = '103'; //Input value >0, and for ETH msg.value and amount shall match
  string public constant VL_INVALID_WITHDRAW_AMOUNT = '104'; //Withdraw amount exceeds provided collateral, or falls undercollaterized
  string public constant VL_INVALID_BORROW_AMOUNT = '105'; //Borrow amount does not meet collaterization
  string public constant VL_NO_DEBT_TO_PAYBACK = '106'; //Msg sender has no debt amount to be payback
  string public constant VL_MISSING_ERC20_ALLOWANCE = '107'; //Msg sender has not approved ERC20 full amount to transfer
  string public constant VL_USER_NOT_LIQUIDATABLE = '108'; //User debt position is not liquidatable
  string public constant VL_DEBT_LESS_THAN_AMOUNT = '109'; //User debt is less than amount to partial close
  string public constant VL_PROVIDER_ALREADY_ADDED = '110'; // Provider is already added in Provider Array
  string public constant VL_NOT_AUTHORIZED = '111'; //Not authorized
  string public constant VL_INVALID_COLLATERAL = '112'; //Collateral is not in active in vault
  string public constant VL_NO_ERC20_BALANCE = '113'; //User does not have ERC20 balance
  string public constant VL_INPUT_ERROR = '114'; //Check inputs. For ERC1155 batch functions, array sizes should match.
  string public constant VL_ASSET_EXISTS ='115';  //Asset intended to be added already exists in FujiERC1155
  string public constant VL_ZERO_ADDR_1155 ='116'; //ERC1155: balance/transfer for zero address
  string public constant VL_NOT_A_CONTRACT = '117'; //Address is not a contract.
  string public constant VL_INVALID_ASSETID_1155 = '118'; //ERC1155 Asset ID is invalid.
  string public constant VL_NO_ERC1155_BALANCE ='119';//ERC1155: insufficient balance for transfer.
  string public constant VL_MISSING_ERC1155_APPROVAL = '120'; //ERC1155: transfer caller is not owner nor approved.
  string public constant VL_RECEIVER_REJECT_1155 = '121'; //ERC1155Receiver rejected tokens
  string public constant VL_RECEIVER_CONTRACT_NON_1155 = '122'; //ERC1155: transfer to non ERC1155Receiver implementer
  string public constant VL_OPTIMIZER_FEE_SMALL ='123'; //Fuji OptimizerFee has to be > 1 RAY (1e27)
  string public constant VL_UNDERCOLLATERIZED_ERROR = '124'; // Flashloan-Flashclose cannot be used when User's collateral is worth less than intended debt position to close.
  string public constant VL_MINIMUM_PAYBACK_ERROR = '125'; // Minimum Amount payback should be at least Fuji Optimizerfee accrued interest.

  string public constant MATH_DIVISION_BY_ZERO = '201';
  string public constant MATH_ADDITION_OVERFLOW = '202';
  string public constant MATH_MULTIPLICATION_OVERFLOW = '203';

  string public constant RF_NO_GREENLIGHT = '300'; // No green light authorization to proceed with refinancing

  string public constant VLT_CALLER_MUST_BE_VAULT = '401'; // The caller of this function must be a vault

  string public constant SP_ALPHA_ETH_CAP_VALUE = '901'; // One ETH cap value for Alpha Version < 1 ETH
  string public constant SP_ALPHA_ADDR_NOT_WHTLIST = '902'; //Address is not Whitelisted to use alpha version Fuji Protocol
  string public constant SP_ALPHA_ADDR_OK_WHTLIST = '903'; //Address has already been Whitelisted!
  string public constant SP_ALPHA_WHTLIST_FULL = '904'; //Whitelist address list is already full
  string public constant SP_ALPHA_WAIT_BLOCKLAG = '905'; //Block-lag for adding next address to whitelist has not passed



}
