// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/IERC1155MetadataURIUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../../libraries/Errors.sol";

/**
 *
 * @dev Implementation of the Base ERC1155 multi-token standard functions
 * for Fuji Protocol control of User collaterals and borrow debt positions.
 * Originally based on Openzeppelin
 *
 */

abstract contract FujiBaseERC1155 is IERC1155Upgradeable, ERC165Upgradeable, ContextUpgradeable {
  using AddressUpgradeable for address;

  // FujiBaseERC1155 Events

  /**
   * @dev Log a change in URI for all tokens
   */
  event URIGlobalChanged(string newUri);

  // Mapping from token ID to account balances
  mapping(uint256 => mapping(address => uint256)) internal _balances;

  // Mapping from account to operator approvals
  mapping(address => mapping(address => bool)) internal _operatorApprovals;

  // Mapping from token ID to totalSupply
  mapping(uint256 => uint256) internal _totalSupply;

  //URI for all token types by relying on ID substitution
  //https://token.fujiDao.org/{id}.json
  string internal _uri;

  /**
   * @return The total supply of a token id
   **/
  function totalSupply(uint256 id) public view virtual returns (uint256) {
    return _totalSupply[id];
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC165Upgradeable, IERC165Upgradeable)
    returns (bool)
  {
    return
      interfaceId == type(IERC1155Upgradeable).interfaceId ||
      interfaceId == type(IERC1155MetadataURIUpgradeable).interfaceId ||
      super.supportsInterface(interfaceId);
  }

  /**
   * @dev See {IERC1155MetadataURI-uri}.
   * Clients calling this function must replace the `\{id\}` substring with the
   * actual token type ID.
   */
  function uri(uint256) public view virtual returns (string memory) {
    return _uri;
  }

  /**
   * @dev See {IERC1155-balanceOf}.
   * Requirements:
   * - `account` cannot be the zero address.
   */
  function balanceOf(address account, uint256 id) public view virtual override returns (uint256) {
    require(account != address(0), Errors.VL_ZERO_ADDR_1155);
    return _balances[id][account];
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}.
   * Requirements:
   * - `accounts` and `ids` must have the same length.
   */
  function balanceOfBatch(address[] memory accounts, uint256[] memory ids)
    public
    view
    override
    returns (uint256[] memory)
  {
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
    require(_msgSender() != operator, Errors.VL_INPUT_ERROR);

    _operatorApprovals[_msgSender()][operator] = approved;
    emit ApprovalForAll(_msgSender(), operator, approved);
  }

  /**
   * @dev See {IERC1155-isApprovedForAll}.
   */
  function isApprovedForAll(address account, address operator)
    public
    view
    virtual
    override
    returns (bool)
  {
    return _operatorApprovals[account][operator];
  }

  /**
   * @dev Being used for accounting purposes, tokens in {FujiERC1155} are non transferrable.
   * Function included to comply with {IERC1155}
   * See {IERC1155-safeTransferFrom}.
   */
  function safeTransferFrom(
    address, // from
    address, // to
    uint256, // id
    uint256, // amount
    bytes memory // data
  ) public virtual override {
    revert(Errors.VL_ERC1155_NOT_TRANSFERABLE);
  }

  /**
   * @dev Batch implementation of 'safeTransferFrom'.
   * Refer to 'safeTransferFrom'.
   */
  function safeBatchTransferFrom(
    address, // from
    address, // to
    uint256[] memory, // ids
    uint256[] memory, // amounts
    bytes memory //  data
  ) public virtual override {
    revert(Errors.VL_ERC1155_NOT_TRANSFERABLE);
  }
}
