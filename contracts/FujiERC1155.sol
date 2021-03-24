// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Context} from "@openzeppelin//contracts/utils/Context.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";


contract Fuji1155Helpers {

  mapping(address => bool ) private VaultAddrVerified;

  bool public transfersActive;

  function isVault(address _addr) internal returns (bool) {
    if (VaultAddrVerified[_addr]) {
      return true;
    } else {
      return false;
    }
  }

}

/**
 *
 * @dev Implementation of the ERC1155 multi-token for Fuji Protocol control of User collaterals and borrow debt positions.
 * Originally based on openzeppelin
 *
 */

contract FujiERC1155 is IERC1155, ERC165, Fuji1155Helpers {

  constructor (
    bool _transfersActive,
  ) {

    transfersActive = _transfersActive;
  }

  using Address for address;
  using SafeMath for uint256;

  /*Global Asset IDs Manager*/

  //Asset Types
  enum AssetType {
    collateralToken,
    debtToken
  }

  //FujiERC1155 Asset ID Mapping
  //AssetType => asset address (ERC20) => ERC1155 Asset ID
  mapping (AssetType => mapping(address => uint256)) public AssetIDs;

  uint256 public NumOfCollateralsAssets;
  uint256 public NumofBorrowAssets;

  //User Balances
  // ERC1155 Asset ID => User Address => Balance
  mapping (uint256 => mapping(address => uint256)) private Userbalances;

  //Transfer Approvals
  // User address => Vault Address => boolean
  mapping (address => mapping(address => bool)) private _operatorApprovals;

  modifier onlyVault() {
    require(
      isVault(_msgSender()),
      Errors.VL_NOT_AUTHORIZED);
    _;
  }

  modifier isTransferActive() {
    require(transfersActive, Errors.VL_NOT_AUTHORIZED);
    _;
  }

  function addAsset(AssetType memory Type, address _assetAddr,uint256 _AssetID) public onlyOwner {
    require(AssetIDs[Type][_assetAddr] == 0, Errors.VL_ASSET_EXISTS);
    AssetIDs[Type][_assetAddr] == _AssetID;

    if (Type == AssetType.collateralToken) {
      NumOfCollateralsAssets = NumOfCollateralsAssets.add(1);
    } else if (Type == AssetType.debtToken) {
      NumofBorrowAssets = NumofBorrowAssets.add(1);
    }
  }

  function verifyVault(address _vaultaddr) public onlyOwner {
    require(_vaultaddr.isContract, Errors.VL_NOT_A_CONTRACT);
    VaultAddrVerified[_vaultaddr] = true;
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
    require(accounts.length == ids.length, "ERC1155: accounts and ids length mismatch");

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
      require(_msgSender() != operator, "ERC1155: setting approval status for self");

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
  ) external override isTransferActive {
    require(to != address(0), Errors.VL_ZERO_ADDR_1155);
    require(
        from == _msgSender() || isApprovedForAll(from, _msgSender()),
        "ERC1155: caller is not owner nor approved"
    );

    address operator = _msgSender();

    _beforeTokenTransfer(operator, from, to, _asSingletonArray(id), _asSingletonArray(amount), data);

    uint256 fromBalance = _balances[id][from];
    require(fromBalance >= amount, "ERC1155: insufficient balance for transfer");
    _balances[id][from] = fromBalance - amount;
    _balances[id][to] += amount;

    emit TransferSingle(operator, from, to, id, amount);

    _doSafeTransferAcceptanceCheck(operator, from, to, id, amount, data);
  }

  /**
 * @dev See {IERC1155-safeBatchTransferFrom}.
 */
  function safeBatchTransferFrom(
      address from,
      address to,
      uint256[] memory ids,
      uint256[] memory amounts,
      bytes memory data
  )
      public
      override
      isTransferActive
  {
      require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");
      require(to != address(0), "ERC1155: transfer to the zero address");
      require(
          from == _msgSender() || isApprovedForAll(from, _msgSender()),
          "ERC1155: transfer caller is not owner nor approved"
      );

      address operator = _msgSender();

      _beforeTokenTransfer(operator, from, to, ids, amounts, data);

      for (uint256 i = 0; i < ids.length; ++i) {
          uint256 id = ids[i];
          uint256 amount = amounts[i];

          uint256 fromBalance = _balances[id][from];
          require(fromBalance >= amount, "ERC1155: insufficient balance for transfer");
          _balances[id][from] = fromBalance - amount;
          _balances[id][to] += amount;
      }

      emit TransferBatch(operator, from, to, ids, amounts);

      _doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data);
  }


  /**
 * @dev Creates tokens of token type `id`, and assigns them to `account`.
 * Emits a {TransferSingle} event.
 * Requirements:
 * - `account` cannot be the zero address.
 * - If `account` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
 * acceptance magic value.
 */
 function _mint(address account, uint256 id, uint256 amount, bytes memory data) external override onlyVault {

    require(account != address(0), Errors.VL_ZERO_ADDR_1155);
    require(AssetIDs[Type][_assetAddr] != 0, Errors.VL_ASSET_EXISTS);

    address operator = _msgSender();

    _balances[id][account] += amount;
    emit TransferSingle(operator, address(0), account, id, amount);

    _doSafeTransferAcceptanceCheck(operator, address(0), account, id, amount, data);
  }

  /**
  * @dev xref:ROOT:erc1155.adoc#batch-operations[Batched] version of {_mint}.
  * Requirements:
  * - `ids` and `amounts` must have the same length.
  * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155BatchReceived} and return the
  * acceptance magic value.
  */
 function _mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external override onlyVault {
     require(to != address(0), "ERC1155: mint to the zero address");
     require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");

     address operator = _msgSender();

     for (uint i = 0; i < ids.length; i++) {
         _balances[ids[i]][to] += amounts[i];
     }

     emit TransferBatch(operator, address(0), to, ids, amounts);

     _doSafeBatchTransferAcceptanceCheck(operator, address(0), to, ids, amounts, data);
 }

   /**
   * @dev Destroys `amount` tokens of token type `id` from `account`
   *
   * Requirements:
   *
   * - `account` cannot be the zero address.
   * - `account` must have at least `amount` tokens of token type `id`.
   */
  function _burn(address account, uint256 id, uint256 amount) internal virtual {
      require(account != address(0), "ERC1155: burn from the zero address");

      address operator = _msgSender();

      uint256 accountBalance = _balances[id][account];
      require(accountBalance >= amount, "ERC1155: burn amount exceeds balance");
      _balances[id][account] = accountBalance - amount;

      emit TransferSingle(operator, account, address(0), id, amount);
  }

  /**
   * @dev xref:ROOT:erc1155.adoc#batch-operations[Batched] version of {_burn}.
   *
   * Requirements:
   *
   * - `ids` and `amounts` must have the same length.
   */
  function _burnBatch(address account, uint256[] memory ids, uint256[] memory amounts) internal virtual {
      require(account != address(0), "ERC1155: burn from the zero address");
      require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");

      address operator = _msgSender();

      for (uint i = 0; i < ids.length; i++) {
          uint256 id = ids[i];
          uint256 amount = amounts[i];

          uint256 accountBalance = _balances[id][account];
          require(accountBalance >= amount, "ERC1155: burn amount exceeds balance");
          _balances[id][account] = accountBalance - amount;
      }

      emit TransferBatch(operator, account, address(0), ids, amounts);
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
                  revert("ERC1155: ERC1155Receiver rejected tokens");
              }
          } catch Error(string memory reason) {
              revert(reason);
          } catch {
              revert("ERC1155: transfer to non ERC1155Receiver implementer");
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
                  revert("ERC1155: ERC1155Receiver rejected tokens");
              }
          } catch Error(string memory reason) {
              revert(reason);
          } catch {
              revert("ERC1155: transfer to non ERC1155Receiver implementer");
          }
      }
  }


  /**
 * @dev See {IERC165-supportsInterface}.
 */
  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
      return interfaceId == type(IERC1155).interfaceId
          || interfaceId == type(IERC1155MetadataURI).interfaceId
          || super.supportsInterface(interfaceId);
  }



}
