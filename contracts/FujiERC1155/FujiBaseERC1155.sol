// SPDX-License-Identifier: MIT

pragma solidity >= 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/IERC1155MetadataURI.sol";
import {ERC165} from "@openzeppelin/contracts/introspection/ERC165.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Errors} from "../Errors.sol";

/**
 *
 * @dev Implementation of the Base ERC1155 multi-token standard functions
 * for Fuji Protocol control of User collaterals and borrow debt positions.
 * Originally based on Openzeppelin
 *
 */

contract FujiBaseERC1155 is IERC1155, ERC165, Errors {

  using Address for address;

  using SafeMath for uint256;

  // Mapping from token ID to account balances
  mapping (uint256 => mapping(address => uint256)) private _balances;

  // Mapping from account to operator approvals
  mapping (address => mapping(address => bool)) private _operatorApprovals;

  // Mapping from token ID to totalSupply
  mapping (uint256 => uint256) internal _totalSupply;

  //Fuji ERC1155 Transfer Control
  bool public transfersActive;

  modifier isTransferActive() {
    require(transfersActive, Errors.VL_NOT_AUTHORIZED);
    _;
  }

  //URI for all token types by relying on ID substitution
  //https://token.fujiDao.org/{id}.json
  string private _uri;

  /**
 * @return The total supply of a token id
 **/
 function totalSupply(uint256 id) public view virtual override returns (uint256) {
   return _totalSupply[id];
 }

  /**
 * @dev See {IERC165-supportsInterface}.
 */
 function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
    return interfaceId == type(IERC1155).interfaceId
        || interfaceId == type(IERC1155MetadataURI).interfaceId
        || super.supportsInterface(interfaceId);
  }

  /**
  * @dev See {IERC1155MetadataURI-uri}.
  * Clients calling this function must replace the `\{id\}` substring with the
  * actual token type ID.
  */
  function uri(uint256) public view virtual override returns (string memory) {
      return _uri;
  }

  /**
  * @dev See {IERC1155-balanceOf}.
  * Requirements:
  * - `account` cannot be the zero address.
  */
  function balanceOf(address account, uint256 id) public view override returns (uint256) {
    require(account != address(0), Errors.VL_ZERO_ADDR_1155);
    return _balances[id][account];
  }

  /**
  * @dev See {IERC1155-balanceOfBatch}.
  * Requirements:
  * - `accounts` and `ids` must have the same length.
  */
  function balanceOfBatch(address[] memory accounts, uint256[] memory ids) public view override returns (uint256[] memory) {
    require(accounts.length == ids.length, Errors.VL_INPUT_ERROR);

    uint256[] memory batchBalances = new uint256[](accounts.length);

    for (uint256 i = 0; i < accounts.length; ++i) {
        batchBalances[i] = balanceOf(accounts[i], ids[i]);
    }

    return batchBalances;
  }

  /**
  * @dev See {IERC1155-setApprovalForAll}.
  */
  function setApprovalForAll(address operator, bool approved) public virtual override {
    require(_msgSender() != operator, Errors.VL_INPUT_ERROR );

    _operatorApprovals[_msgSender()][operator] = approved;
    emit ApprovalForAll(_msgSender(), operator, approved);
  }

  /**
  * @dev See {IERC1155-isApprovedForAll}.
  */
  function isApprovedForAll(address account, address operator) public view virtual override returns (bool) {
    return _operatorApprovals[account][operator];
  }

  /**
 * @dev See {IERC1155-safeTransferFrom}.
  */
  function safeTransferFrom(
     address from,
     address to,
     uint256 id,
     uint256 amount,
     bytes memory data
  ) public virtual override isTransferActive {
    require(to != address(0), Errors.VL_ZERO_ADDR_1155);
    require(
      from == _msgSender() || isApprovedForAll(from, _msgSender()),
      Errors.VL_MISSING_ERC1155_APPROVAL
    );

    address operator = _msgSender();

    _beforeTokenTransfer(operator, from, to, _asSingletonArray(id), _asSingletonArray(amount), data);

    uint256 fromBalance = _balances[id][from];
    require(fromBalance >= amount, Errors.VL_NO_ERC1155_BALANCE);

    _balances[id][from] = fromBalance.sub(amount);
    _balances[id][to] = uint256(_balances[id][to]).add(amount);

    emit TransferSingle(operator, from, to, id, amount);

    _doSafeTransferAcceptanceCheck(operator, from, to, id, amount, data);
  }


   /**
  * @dev See {IERC1155-safeBatchTransferFrom}.
  */
  function safeBatchTransferFrom (
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
   ) public virtual override isTransferActive {
       require(ids.length == amounts.length, Errors.VL_INPUT_ERROR);
       require(to != address(0), Errors.VL_ZERO_ADDR_1155);
       require(
           from == _msgSender() || isApprovedForAll(from, _msgSender()),
           Errors.VL_MISSING_ERC1155_APPROVAL
       );

       address operator = _msgSender();

       _beforeTokenTransfer(operator, from, to, ids, amounts, data);

       for (uint256 i = 0; i < ids.length; ++i) {
           uint256 id = ids[i];
           uint256 amount = amounts[i];

           uint256 fromBalance = _balances[id][from];
           require(fromBalance >= amount, Errors.VL_NO_ERC1155_BALANCE);
           _balances[id][from] = fromBalance.sub(amount);
           _balances[id][to] = uint256(_balances[id][to]).add(amount);;
       }

       emit TransferBatch(operator, from, to, ids, amounts);

       _doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data);
   }

  function _doSafeTransferAcceptanceCheck(
      address operator,
      address from,
      address to,
      uint256 id,
      uint256 amount,
      bytes memory data
  )
      private
  {
      if (to.isContract()) {
          try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (bytes4 response) {
              if (response != IERC1155Receiver(to).onERC1155Received.selector) {
                  revert(Errors.VL_RECEIVER_REJECT_1155);
              }
          } catch Error(string memory reason) {
              revert(reason);
          } catch {
              revert(Errors.VL_RECEIVER_CONTRACT_NON_1155);
          }
      }
  }

  function _doSafeBatchTransferAcceptanceCheck(
      address operator,
      address from,
      address to,
      uint256[] memory ids,
      uint256[] memory amounts,
      bytes memory data
  )
      private
  {
      if (to.isContract()) {
          try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (bytes4 response) {
              if (response != IERC1155Receiver(to).onERC1155BatchReceived.selector) {
                  revert(Errors.VL_RECEIVER_REJECT_1155);
              }
          } catch Error(string memory reason) {
              revert(reason);
          } catch {
              revert(Errors.VL_RECEIVER_CONTRACT_NON_1155);
          }
      }
  }

  /**
 * @dev See {IERC165-supportsInterface}.
 */
  //function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
  //    return interfaceId == type(IERC1155).interfaceId
  //        || interfaceId == type(IERC1155MetadataURI).interfaceId
  //        || super.supportsInterface(interfaceId);
  //}

}
