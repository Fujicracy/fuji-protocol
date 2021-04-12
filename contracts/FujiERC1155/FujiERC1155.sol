// SPDX-License-Identifier: MIT

pragma solidity >= 0.6.12;
pragma experimental ABIEncoderV2;

import { FujiBaseERC1155 } from "./FujiBaseERC1155.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { WadRayMath } from '../Libraries/WadRayMath.sol';
import { MathUtils } from '../Libraries/MathUtils.sol';

contract F1155Manager is FujiBaseERC1155, Ownable {

  using WadRayMath for uint256;

  //Global Asset Managers

  //Asset Types
  enum AssetType {
    //uint8 = 0
    collateralToken,
    //uint8 = 1
    debtToken
  }

  //FujiERC1155 Asset ID Mapping

  //AssetType => asset reference address => ERC1155 Asset ID
  mapping (AssetType => mapping(address => uint64)) public AssetIDs;

  //ID Control to confirm ID, and avoid repeated uint256 incurrance
  mapping (uint64 => bool) public used_IDs;

  //Control mapping that returns the AssetType of an AssetID
  mapping (uint64 => AssetType) public AssetIDtype;

  uint64 public QtyOfManagedAssets;
  uint64[] public IDsCollateralsAssets;
  uint64[] public IDsBorrowAssets;

  //Asset ID  Liquidity Index mapping
  //AssetId => Liquidity index for asset ID
  mapping (uint64 => uint256) public Indexes;

  uint256 public OptimizerFee;
  uint256 public lastUpdateTimestamp;
  uint256 public fujiIndex;

  //Getter Functions

  /**
  * @dev Getter Function for the Asset ID locally managed
  * @param _Type: enum AssetType, 0 = Collateral asset, 1 = debt asset
  * @param _Addr: Reference Address of the Asset
  */
  function getAssetID(AssetType _Type, address _Addr) external view override returns(uint64) {
    uint256 theID = AssetIDs[_Type][_assetAddr];
    require(used_IDs[theID], Errors.VL_INVALID_ASSETID_1155 );
    return theID;
  }

  /**
  * @dev Getter function to get the AssetType
  * @param _AssetID: AssetID locally managed in ERC1155
  */
  function getAssetIDType(uint264 _AssetID) internal view returns(AssetType) {
    return AssetIDtype[_AssetID];
  }

  /**
  * @dev Getter function to get quantity of assets managed in ERC1155
  */
  function getQtyOfManagedAssets() external view override returns(uint264) {
    return QtyOfManagedAssets;
  }

  //Setter Functions

  /**
  * @dev Sets the FujiProtocol Fee to be charged
  * @param _fee; Fee in Ray to charge users for OptimizerFee
  */
  function setOptimizerFee(uint256 _fee) public onlyOwner {
    require(_fee >= ray(), Errors.VL_OPTIMIZER_FEE_SMALL );
    OptimizerFee = _fee;
  }

  /**
  * @dev Adds and initializes liquidity index of a new asset in FujiERC1155
  * @param _Type: enum AssetType, 0 = Collateral asset, 1 = debt asset
  * @param _Addr: Reference Address of the Asset
  */
  function addInitializeAsset(AssetType _Type, address _Addr) external override onlyPermit returns(uint64){

    require(AssetIDs[_Type][_Addr] == 0 , Errors.VL_ASSET_EXISTS);
    uint64 newManagedAssets = QtyOfManagedAssets+1;

    AssetIDs[_Type][_Addr] = newManagedAssets;
    used_IDs[newManagedAssets] = true;
    AssetIDtype[newManagedAssets] = _Type;

    //Push new AssetID to BorrowAsset Array
    IDsCollateralsAssets.push(newManagedAssets);
    //Initialize the liquidity Index
    Indexes[newManagedAssets] = ray();

    //Update QtyOfManagedAssets
    QtyOfManagedAssets = newManagedAssets;

    return newManagedAssets;
  }

  /**
  * @dev Returns an array of the FujiERC1155 IDs on which the user has an Open Position
  * @param _account: user address to check
  * @param _Type: enum AssetType, 0 = Collateral asset, 1 = debt asset
  */
  function engagedIDsOf(address account, AssetType _Type) internal view returns(uint256[] memory _IDs) {
    if(_Type == AssetType.collateralToken) {
      for(uint i; i < IDsCollateralsAssets.length; i++) {
        if(super.balanceOf(account, IDsCollateralsAssets[i]) > 0) {
          _IDs.push(IDsCollateralsAssets[i]);
        }
      }
    } else if (_Type == AssetType.debtToken) {
      for(uint i; i < IDsBorrowAssets.length; i++) {
        if(super.balanceOf(account, IDsBorrowAssets[i]) > 0) {
          _IDs.push(IDsBorrowAssets[i]);
        }
      }
    }
  }

  // Controls for Mint-Burn Operations
  mapping(address => bool) public AddrPermit;

  modifier onlyPermit() {
    require(
      isPermitted(_msgSender()) ||
      msg.sender == owner(),
      Errors.VL_NOT_AUTHORIZED);
    _;
  }

  function addPermit(address _address) public onlyOwner {
    require((_address).isContract(), Errors.VL_NOT_A_CONTRACT);
    AddrPermit[_address] = true;
  }

  function isPermitted(address _address) internal returns (bool _permit) {
    _permit = false;
    if (AddrPermit[_address]) {
      _permit = true;
    }
  }
}




contract FujiERC1155 is IFujiERC1155, F1155Manager {

  constructor (

    bool _transfersActive

  ) public {

    transfersActive = _transfersActive;
    QtyOfManagedAssets = 0;
    fujiIndex =ray();

  }


  /**
   * @dev Updates Index of AssetID
   * @param assetID; ERC1155 ID of the asset which state will be updated.
   * @param newBalance; Amount
   **/
  function updateState(uint256 _AssetID, uint256 newBalance) external onlyPermit {

    uint256 total = totalSupply(_AssetID);

    if (newBalance > 0 && total > 0) {
      uint256 diff = newBalance.sub(total);
      uint256 amountToIndexRatio = (diff.wadToRay()).rayDiv(total.wadToRay());

      uint256 result = amountToIndexRatio.add(WadRayMath.ray());

      result = result.rayMul(Indexes[_AssetID]);
      require(result <= type(uint128).max, Errors.VL_INDEX_OVERFLOW);

      Indexes[_AssetID] = uint128(result);

      if(lastUpdateTimestamp==0){
        lastUpdateTimestamp = block.timestamp;
      }

      uint256 cumulated =
        (MathUtils.calculateCompoundedInterest(OptimizerFee, lastUpdateTimestamp, block.timestamp))
        .rayMul(fujiIndex);

      fujiIndex = cumulated;
      lastUpdateTimestamp = block.timestamp;
    }
  }

  /**
   * @dev Returns the total supply of Asset_ID with accrued interest.
   * @param _AssetID; the Asset ID
   * @return The total supply
   **/
  function totalSupply(uint256 _AssetID) public view virtual override returns (uint256) {
    return super.totalSupply(_AssetID).rayMul(Indexes[_AssetID]);
  }

  /**
   * @dev Returns the scaled total supply of the token ID. Represents sum(token ID Principal /index)
   * @return the scaled total supply
   **/
  function scaledTotalSupply(uint256 _AssetID) public view virtual returns (uint256) {
    return super.totalSupply(_AssetID);
  }

  /**
  * @dev Calculates the principal + accrued interest balance of the user
  * @return The debt balance of the user
  **/
  function balanceOf(address _user, uint256 _AssetID) public view virtual override returns (uint256) {
    uint256 scaledBalance = super.balanceOf(_user, _AssetID);

    if (scaledBalance == 0) {
      return 0;
    }

    return scaledBalance.rayMul(Indexes[_AssetID]).rayMul(fujiIndex);
  }

  /**
  * @dev Calculates the principal + accrued interest balance of the user
  * @return The debt balance of the user owed to the base protocol and fuji protocol
  **/
  function splitBalanceOf(
    address _user,
    uint256 _AssetID
  ) public view virtual override returns (baseprotocol uint256, fuji uint256) {
    uint256 scaledBalance = super.balanceOf(_user, _AssetID);

    if (scaledBalance == 0) {
      return 0;
    }

    baseprotocol = scaledBalance.rayMul(Indexes[_AssetID]);

    fuji = scaledBalance.rayMul(fujiIndex);

  }

  /**
   * @dev Returns the principal balance of the user.
   * @return The debt balance of the user since the last burn/mint action
   **/
  function scaledBalanceOf(address _user, uint256 _AssetID) public view virtual returns (uint256) {
    return super.balanceOf(_user,_AssetID);
  }


  function balanceOfBatchDebt(address account, uint256[] calldata ids) external view override returns (uint256 total) {

    uint256[] memory IDs = engagedIDsOf(address account, AssetType _Type);

    for(uint i; i < IDs.length; i++ ){
      total = total.add(balanceOf(account, IDs[i]));
    }

  }



  /**
 * @dev Mints tokens for Collateral and Debt receipts for the Fuji Protocol
 * Emits a {TransferSingle} event.
 * Requirements:
 * - `account` cannot be the zero address.
 * - If `account` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
 * acceptance magic value.
 * - `amount` should be in WAD
 */
 function mint(address account, uint256 id, uint256 amount, bytes memory data) external onlyPermit {
   require(used_IDs[id], Errors.VL_INVALID_ASSETID_1155 );
   require(account != address(0), Errors.VL_ZERO_ADDR_1155);

   address operator = _msgSender();

   uint256 accountBalance = _balances[id][account];
   uint256 amountScaled = amount.rayDiv(Indexes[id]);

   if(getAssetIDType(id)==AssetType.debtToken) {
     amountScaled = amountScaled.rayDiv(fujiIndex);
   }

   require(amountScaled != 0, Errors.VL_INVALID_MINT_AMOUNT);

   uint256 assetTotalBalance = _totalSupply[id];

   _balances[id][account] = accountBalance.add(amountScaled);
   _totalSupply[id] =assetTotalBalance.add(amountScaled);

   emit TransferSingle(operator, address(0), account, id, amount);

   _doSafeTransferAcceptanceCheck(operator, address(0), account, id, amount, data);
  }

  /**
  * @dev [Batched] version of {mint}.
  * Requirements:
  * - `ids` and `amounts` must have the same length.
  * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155BatchReceived} and return the
  * acceptance magic value.
  */
 function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external onlyPermit {

   for (uint i = 0; i < ids.length; i++) {
       require(used_IDs[ids[i]], Errors.VL_INVALID_ASSETID_1155 );
   }

   require(to != address(0), Errors.VL_ZERO_ADDR_1155);
   require(ids.length == amounts.length, Errors.VL_INPUT_ERROR);

   address operator = _msgSender();

   uint256 accountBalance;
   uint256 assetTotalBalance;
   uint256 amountScaled;

   for (uint i = 0; i < ids.length; i++) {

     accountBalance = _balances[ids[i]][to];
     assetTotalBalance = _totalSupply[ids[i]];

     amountScaled = amounts[i].rayDiv(Indexes[ids[i]]);

     if(getAssetIDType(id)==AssetType.debtToken) {
       amountScaled = amountScaled.rayDiv(fujiIndex);
     }

     require(amountScaled != 0, Errors.VL_INVALID_MINT_AMOUNT);

     _balances[ids[i]][to] = accountBalance.add(amountScaled);
     _totalSupply[ids[i]] = assetTotalBalance.add(amountScaled);

   }

   emit TransferBatch(operator, address(0), to, ids, amounts);

   _doSafeBatchTransferAcceptanceCheck(operator, address(0), to, ids, amounts, data);
 }

   /**
   * @dev Destroys `amount` receipt tokens of token type `id` from `account` for the Fuji Protocol
   * Requirements:
   * - `account` cannot be the zero address.
   * - `account` must have at least `amount` tokens of token type `id`.
   * - `amount` should be in WAD
   */
  function burn(address account, uint256 id, uint256 amount) external onlyPermit{

    require(used_IDs[id], Errors.VL_INVALID_ASSETID_1155);
    require(account != address(0), Errors.VL_ZERO_ADDR_1155);

    address operator = _msgSender();

    uint256 accountBalance = _balances[id][account];
    uint256 assetTotalBalance = _totalSupply[id];

    uint256 amountScaled = amount.rayDiv(Indexes[id]);

    if(getAssetIDType(id)==AssetType.debtToken) {
      amountScaled = amountScaled.rayDiv(fujiIndex);
    }

    require(amountScaled != 0, Errors.VL_INVALID_BURN_AMOUNT);

    require(accountBalance >= amount, Errors.VL_INVALID_BURN_AMOUNT);

    _balances[id][account] = accountBalance.sub(amountScaled);
    _totalSupply[id] = assetTotalBalance.sub(amountScaled);

    emit TransferSingle(operator, account, address(0), id, amount);
  }

  /**
   * @dev [Batched] version of {burn}.
   * Requirements:
   * - `ids` and `amounts` must have the same length.
   */
  function burnBatch(address account, uint256[] memory ids, uint256[] memory amounts) external onlyPermit {

    for (uint i = 0; i < ids.length; i++) {
        require(used_IDs[ids[i]], Errors.VL_INVALID_ASSETID_1155 );
    }

    require(account != address(0), Errors.VL_ZERO_ADDR_1155);
    require(ids.length == amounts.length, Errors.VL_INPUT_ERROR);

    address operator = _msgSender();

    uint256 accountBalance;
    uint256 assetTotalBalance;
    uint256 amountScaled;

    for (uint i = 0; i < ids.length; i++) {

      uint256 amount = amounts[i];

      accountBalance = _balances[ids[i]][account];
      assetTotalBalance = _totalSupply[ids[i]];

      amountScaled = amounts[i].rayDiv(Indexes[ids[i]]);

      if(getAssetIDType(id)==AssetType.debtToken) {
        amountScaled = amountScaled.rayDiv(fujiIndex);
      }

      require(accountBalance >= amount, Errors.VL_NO_ERC1155_BALANCE);

      _balances[ids[i]][account] = accountBalance.sub(amount);
      _totalSupply[ids[i]] = assetTotalBalance.sub(amount);
    }

    emit TransferBatch(operator, account, address(0), ids, amounts);
  }

  /**
  * @dev Sets a new URI for all token types, by relying on the token type ID
  */
  function _setURI(string memory newuri) public onlyOwner {
    _uri = newuri;
  }

}
