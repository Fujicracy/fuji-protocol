// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.8.0;
pragma experimental ABIEncoderV2;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/IERC1155MetadataURI.sol";
import {ERC165} from "@openzeppelin/contracts/introspection/ERC165.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Errors } from './Debt-token/Errors.sol';


contract Fuji1155Helpers is Ownable {

  using Address for address;
  using SafeMath for uint256;

  //Global Asset Managers

  //Asset Types
  enum AssetType {
    collateralToken, //uint8 = 0
    debtToken // uint8 = 1
  }

  //FujiERC1155 Asset ID Mapping
  //AssetType => asset address (ERC20) => ERC1155 Asset ID
  mapping (AssetType => mapping(address => uint256)) public AssetIDs;
  //ID Control to confirm ID, and avoid repeated uint256 incurrance
  mapping (uint256 => bool) public used_IDs;
  //Control mapping that returns the AssetType of an AssetID
  mapping (uint256 => AssetType) public AssetIDtype;

  uint256 public managedAssets = 0;
  uint256[] public IDsCollateralsAssets;
  uint256[] public IDsBorrowAssets;


  function getAssetID(AssetType _Type, address _assetAddr) public view returns(uint256) {
    uint256 theID = AssetIDs[_Type][_assetAddr];
    require(used_IDs[theID], Errors.VL_INVALID_ASSETID_1155 );
    return theID;
  }

  function getAssetIDType(uint256 _AssetID) internal view returns(uint256) {
    return AssetIDtype[_AssetID];
  }

  function addAsset(AssetType _Type, address _assetAddr) public onlyOwner {

    require(AssetIDs[_Type][_assetAddr] == 0 , Errors.VL_ASSET_EXISTS);

    uint256 newManagedAssets = managedAssets+1;

    AssetIDs[_Type][_assetAddr] = newManagedAssets;
    used_IDs[newManagedAssets] = true;
    AssetIDtype[newManagedAssets] = _Type;

    if (_Type == AssetType.collateralToken) {
      IDsCollateralsAssets.push(newManagedAssets);
    } else if (_Type == AssetType.debtToken) {
      IDsBorrowAssets.push(newManagedAssets);
    }

    managedAssets = newManagedAssets;

  }

  //Transfer Control
  bool public transfersActive;

  modifier isTransferActive() {
    require(transfersActive, Errors.VL_NOT_AUTHORIZED);
    _;
  }

  //Vault Controls Only for Mint-Burn Operations
  mapping(address => bool ) private VaultAddrVerified;

  modifier onlyVault() {
    require(
      isVault(_msgSender()),
      Errors.VL_NOT_AUTHORIZED);
    _;
  }

  function verifyVault(address _vaultaddr) public onlyOwner {
    require(_vaultaddr.isContract, Errors.VL_NOT_A_CONTRACT);
    VaultAddrVerified[_vaultaddr] = true;
  }

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
    bool _transfersActive
  ) {

    transfersActive = _transfersActive;
  }

  //Global Total Balances
  mapping (uint256 => uint256) public TotalAsset_IDBalances;

  //User Balances
  // ERC1155 Asset ID => User Address => Balance
  mapping (uint256 => mapping(address => uint256)) private Userbalances;

  //Transfer Approvals
  // User address => Vault Address => boolean
  mapping (address => mapping(address => bool)) private _operatorApprovals;


/**
 * @dev See {IERC1155-balanceOf}.
 * Requirements:
 * - `account` cannot be the zero address.
 */
 function balanceOf(address account, uint256 id) public view override returns (uint256) {
    require(account != address(0), Errors.VL_ZERO_ADDR_1155);
    return Userbalances[id][account];
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
  ) external override isTransferActive {
    require(to != address(0), Errors.VL_ZERO_ADDR_1155);
    require(
        from == _msgSender() || isApprovedForAll(from, _msgSender()),
        Errors.VL_MISSING_ERC1155_APPROVAL
    );

    address operator = _msgSender();

    //_beforeTokenTransfer(operator, from, to, _asSingletonArray(id), _asSingletonArray(amount), data);

    uint256 fromBalance = Userbalances[id][from];
    require(fromBalance >= amount, Errors.VL_NO_ERC1155_BALANCE);
    Userbalances[id][from] = fromBalance - amount;
    Userbalances[id][to] += amount;

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
      require(ids.length == amounts.length, Errors.VL_INPUT_ERROR);
      require(to != address(0), Errors.VL_ZERO_ADDR_1155);
      require(
          from == _msgSender() || isApprovedForAll(from, _msgSender()),
          Errors.VL_MISSING_ERC1155_APPROVAL
      );

      address operator = _msgSender();

      for (uint256 i = 0; i < ids.length; ++i) {
          uint256 id = ids[i];
          uint256 amount = amounts[i];

          uint256 fromBalance = Userbalances[id][from];
          require(fromBalance >= amount, Errors.VL_NO_ERC1155_BALANCE);
          Userbalances[id][from] = fromBalance - amount;
          Userbalances[id][to] += amount;
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
 function mint(address account, uint256 id, uint256 amount, bytes memory data) external onlyVault {
   require(used_IDs[id], Errors.VL_INVALID_ASSETID_1155 );
   require(account != address(0), Errors.VL_ZERO_ADDR_1155);

   address operator = _msgSender();

   uint256 accountBalance = Userbalances[id][account];
   uint256 assetTotalBalance = TotalAsset_IDBalances[id];

   Userbalances[id][account] = accountBalance.add(amount);
   TotalAsset_IDBalances[id] =assetTotalBalance.add(amount);

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
 function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external onlyVault {

   for (uint i = 0; i < ids.length; i++) {
       require(used_IDs[ids[i]], Errors.VL_INVALID_ASSETID_1155 );
   }

   require(to != address(0), Errors.VL_ZERO_ADDR_1155);
   require(ids.length == amounts.length, Errors.VL_INPUT_ERROR);

   address operator = _msgSender();

   uint256 accountBalance;
   uint256 assetTotalBalance;

   for (uint i = 0; i < ids.length; i++) {

     accountBalance = Userbalances[ids[i]][to];
     assetTotalBalance = TotalAsset_IDBalances[ids[i]];

     Userbalances[ids[i]][to] = accountBalance.add(amounts[i]);
     TotalAsset_IDBalances[ids[i]] = assetTotalBalance.add(amounts[i]);

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
  function burn(address account, uint256 id, uint256 amount) external onlyVault{

    require(used_IDs[id], Errors.VL_INVALID_ASSETID_1155);
    require(account != address(0), Errors.VL_ZERO_ADDR_1155);

    address operator = _msgSender();

    uint256 accountBalance = Userbalances[id][account];
    uint256 assetTotalBalance = TotalAsset_IDBalances[id];

    require(accountBalance >= amount, Errors.VL_NO_ERC1155_BALANCE);

    Userbalances[id][account] = accountBalance.sub(amount);
    TotalAsset_IDBalances[id] = assetTotalBalance.sub(amount);

    emit TransferSingle(operator, account, address(0), id, amount);
  }

  /**
   * @dev xref:ROOT:erc1155.adoc#batch-operations[Batched] version of {_burn}.
   *
   * Requirements:
   *
   * - `ids` and `amounts` must have the same length.
   */
  function burnBatch(address account, uint256[] memory ids, uint256[] memory amounts) external onlyVault {

    for (uint i = 0; i < ids.length; i++) {
        require(used_IDs[ids[i]], Errors.VL_INVALID_ASSETID_1155 );
    }

    require(account != address(0), Errors.VL_ZERO_ADDR_1155);
    require(ids.length == amounts.length, Errors.VL_INPUT_ERROR);

    address operator = _msgSender();

    uint256 accountBalance;
    uint256 assetTotalBalance;

    for (uint i = 0; i < ids.length; i++) {

      uint256 amount = amounts[i];

      accountBalance = Userbalances[ids[i]][account];
      assetTotalBalance = TotalAsset_IDBalances[ids[i]];

      require(accountBalance >= amount, Errors.VL_NO_ERC1155_BALANCE);

      Userbalances[ids[i]][account] = accountBalance.sub(amount);
      TotalAsset_IDBalances[ids[i]] = assetTotalBalance.sub(amount);
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
  //function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
  //    return interfaceId == type(IERC1155).interfaceId
  //        || interfaceId == type(IERC1155MetadataURI).interfaceId
  //        || super.supportsInterface(interfaceId);
  //}



}
