// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./abstracts/fujiERC1155/FujiBaseERC1155.sol";
import "./abstracts/fujiERC1155/F1155Manager.sol";
import "./abstracts/claimable/ClaimableUpgradeable.sol";
import "./interfaces/IFujiERC1155.sol";
import "./libraries/WadRayMath.sol";
import "./libraries/Errors.sol";

/**
 *
 * @dev Contract implementing the extension functions for interest rate bearing tokens.
 * See {FujiBaseERC1155}.
 *
 */

contract FujiERC1155 is IFujiERC1155, FujiBaseERC1155, F1155Manager {
  using WadRayMath for uint256;

  // FujiERC1155 Asset ID Mapping

  // AssetType => asset reference address => ERC1155 Asset ID
  mapping(AssetType => mapping(address => uint256)) public assetIDs;

  // Control mapping that returns the AssetType of an AssetID
  mapping(uint256 => AssetType) public assetIDtype;

  uint64 public override qtyOfManagedAssets;

  // Asset ID  Liquidity Index mapping
  // AssetId => Liquidity index for asset ID
  mapping(uint256 => uint256) public indexes;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {}

  /**
   * @dev Sets the deployer as the initial owner in {Claimable}
   */
  function initialize() external initializer {
    __ERC165_init();
    __Context_init();
    __Claimable_init();
  }

  /**
   * @dev Updates Index of AssetID
   * @param _assetID: ERC1155 ID of the asset which state will be updated.
   * @param newBalance: Amount
   * Requirements:
   * - Not less than previous index
   * - Not overflow
   **/
  function updateState(uint256 _assetID, uint256 newBalance) external override onlyPermit {
    uint256 total = totalSupply(_assetID);
    if (newBalance > 0 && total > 0 && newBalance > total) {
      uint256 newIndex = (indexes[_assetID] * newBalance) / total;
      indexes[_assetID] = uint128(newIndex);
    }
  }

  /**
   * @dev Returns the total supply of Asset_ID with accrued interest.
   * @param _assetID: ERC1155 ID of the asset which state will be updated.
   **/
  function totalSupply(uint256 _assetID) public view virtual override returns (uint256) {
    return super.totalSupply(_assetID).rayMul(indexes[_assetID]);
  }

  /**
   * @dev Returns the scaled total supply of the token ID. Represents sum(token ID Principal /index)
   * @param _assetID: ERC1155 ID of the asset which state will be updated.
   **/
  function scaledTotalSupply(uint256 _assetID) public view virtual returns (uint256) {
    return super.totalSupply(_assetID);
  }

  /**
   * @dev Returns the principal + accrued interest balance of the user
   * @param _account: address of the User
   * @param _assetID: ERC1155 ID of the asset which state will be updated.
   **/
  function balanceOf(address _account, uint256 _assetID)
    public
    view
    override(FujiBaseERC1155, IFujiERC1155)
    returns (uint256)
  {
    uint256 scaledBalance = super.balanceOf(_account, _assetID);

    if (scaledBalance == 0) {
      return 0;
    }

    return scaledBalance.rayMul(indexes[_assetID]);
  }

  /**
   * @dev Returns Scaled Balance of the user (e.g. balance/index)
   * @param _account: address of the User
   * @param _assetID: ERC1155 ID of the asset which state will be updated.
   **/
  function scaledBalanceOf(address _account, uint256 _assetID)
    public
    view
    virtual
    returns (uint256)
  {
    return super.balanceOf(_account, _assetID);
  }

  /**
   * @dev Mints tokens for Collateral and Debt receipts for the Fuji Protocol
   * Emits a {TransferSingle} event.
   * Requirements:
   * - `_account` cannot be the zero address.
   * - If `account` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
   * acceptance magic value.
   * - `_amount` should be in WAD
   */
  function mint(
    address _account,
    uint256 _id,
    uint256 _amount
  ) external override onlyPermit {
    require(_account != address(0), Errors.VL_ZERO_ADDR_1155);

    _mint(_account, _id, _amount);

    address operator = _msgSender();

    emit TransferSingle(operator, address(0), _account, _id, _amount);
  }

  /**
   * @dev [Batched] version of {mint}.
   * Requirements:
   * - `_ids` and `_amounts` must have the same length.
   * - If `_to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155BatchReceived} and return the
   * acceptance magic value.
   */
  function mintBatch(
    address _to,
    uint256[] memory _ids,
    uint256[] memory _amounts
  ) external onlyPermit {
    require(_to != address(0), Errors.VL_ZERO_ADDR_1155);
    require(_ids.length == _amounts.length, Errors.VL_INPUT_ERROR);

    for (uint256 i = 0; i < _ids.length; i++) {
      _mint(_to, _ids[i], _amounts[i]);
    }

    address operator = _msgSender();

    emit TransferBatch(operator, address(0), _to, _ids, _amounts);
  }

  /**
   * @dev Destroys `_amount` receipt tokens of token type `_id` from `account` for the Fuji Protocol
   * Requirements:
   * - `account` cannot be the zero address.
   * - `account` must have at least `_amount` tokens of token type `_id`.
   * - `_amount` should be in WAD
   */
  function burn(
    address _account,
    uint256 _id,
    uint256 _amount
  ) external override onlyPermit {
    require(_account != address(0), Errors.VL_ZERO_ADDR_1155);

    _burn(_account, _id, _amount);

    emit TransferSingle(_msgSender(), _account, address(0), _id, _amount);
  }

  /**
   * @dev [Batched] version of {burn}.
   * Requirements:
   * - `_ids` and `_amounts` must have the same length.
   */
  function burnBatch(
    address _account,
    uint256[] memory _ids,
    uint256[] memory _amounts
  ) external onlyPermit {
    require(_account != address(0), Errors.VL_ZERO_ADDR_1155);
    require(_ids.length == _amounts.length, Errors.VL_INPUT_ERROR);

    for (uint256 i = 0; i < _ids.length; i++) {
      _burn(_account, _ids[i], _amounts[i]);
    }

    emit TransferBatch(_msgSender(), _account, address(0), _ids, _amounts);
  }

  //Getter Functions

  /**
   * @dev Getter Function for the Asset ID locally managed
   * @param _type: enum AssetType, 0 = Collateral asset, 1 = debt asset
   * @param _addr: Reference Address of the Asset
   * Returns token 'id' of asset '_addr'
   */
  function getAssetID(AssetType _type, address _addr) external view override returns (uint256 id) {
    id = assetIDs[_type][_addr];
    require(id <= qtyOfManagedAssets, Errors.VL_INVALID_ASSETID_1155);
  }

  //Setter Functions

  /**
   * @dev Sets a new URI for all token types, by relying on the token type ID
   * substitution mechanism.
   * Because these URIs cannot be meaningfully represented by the EIP1155 {URI} event,
   * due to {indexed id} input, this function does emit the specified EIP1155 {URI} event.
   * Instead a custom event {URIGlobalChanged} is emitted.
   */
  function setURI(string memory _newUri) public onlyOwner {
    _uri = _newUri;
    emit URIGlobalChanged(_newUri);
  }

  /**
   * @dev Adds and initializes liquidity index of a new asset in FujiERC1155
   * @param _type: enum AssetType, 0 = Collateral asset, 1 = debt asset
   * @param _addr: Reference Address of the Asset
   */
  function addInitializeAsset(AssetType _type, address _addr)
    external
    override
    onlyPermit
    returns (uint64)
  {
    require(assetIDs[_type][_addr] == 0, Errors.VL_ASSET_EXISTS);

    assetIDs[_type][_addr] = qtyOfManagedAssets;
    assetIDtype[qtyOfManagedAssets] = _type;

    //Initialize the liquidity Index
    indexes[qtyOfManagedAssets] = WadRayMath.ray();
    qtyOfManagedAssets++;

    return qtyOfManagedAssets - 1;
  }

  /**
   * @dev Mints tokens for Collateral and Debt receipts for the Fuji Protocol
   */
  function _mint(
    address _account,
    uint256 _id,
    uint256 _amount
  ) internal {
    uint256 accountBalance = _balances[_id][_account];
    uint256 assetTotalBalance = _totalSupply[_id];
    uint256 amountScaled = _amount.rayDiv(indexes[_id]);

    require(amountScaled != 0, Errors.VL_INVALID_MINT_AMOUNT);

    _balances[_id][_account] = accountBalance + amountScaled;
    _totalSupply[_id] = assetTotalBalance + amountScaled;
  }

  /**
   * @dev Destroys `_amount` receipt tokens of token type `_id` from `account` for the Fuji Protocol
   */
  function _burn(
    address _account,
    uint256 _id,
    uint256 _amount
  ) internal {
    uint256 accountBalance = _balances[_id][_account];
    uint256 assetTotalBalance = _totalSupply[_id];

    uint256 amountScaled = _amount.rayDiv(indexes[_id]);

    require(amountScaled != 0 && accountBalance >= amountScaled, Errors.VL_INVALID_BURN_AMOUNT);

    _balances[_id][_account] = accountBalance - amountScaled;
    _totalSupply[_id] = assetTotalBalance - amountScaled;
  }
}
