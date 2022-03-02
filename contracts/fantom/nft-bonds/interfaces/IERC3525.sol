pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title ERC-3525 Semi-Fungible Token Standard
 * @dev See https://eips.ethereum.org/EIPS/eip-3525
 * Note: the ERC-165 identifier for this interface is 0x1487d183.
 */
interface IERC3525 is ERC721 {

    /**
     * @dev This emits when partial units of a token are transferred to another.
     * @param _from The address of the owner of `_tokenId`
     * @param _to The address of the owner of `_targetTokenId`
     * @param _tokenId The token to partially transfer
     * @param _targetTokenId The token to receive the units transferred
     @ @param _transferUnits The amount of units to transfer
     */
    event TransferUnits(address indexed _from, address indexed _to, uint256 indexed _tokenId, uint256 _targetTokenId, uint256 _transferUnits);

    /**
     * @dev This emits when a token is split into two.
     * @param _owner The address of the owner of both `_tokenId` and `_newTokenId`
     * @param _tokenId The token to be split
     * @param _newTokenId The new token created after split
     @ @param _splitUnits The amount of units to be split from `_tokenId` to `_newTokenId`
     */
    event Split(address indexed _owner, uint256 indexed _tokenId, uint256 _newTokenId, uint256 _splitUnits);
    
    /**
     * @dev This emits when a token is merged into another.
     * @param _owner The address of the owner of both `_tokenId` and `_targetTokenId`
     * @param _tokenId The token to be merged into `_targetTokenId`
     * @param _targetTokenId The token to receive all units of `_tokenId`
     @ @param _mergeUnits The amount of units to be merged from `_tokenId` to `_targetTokenId`
     */
    event Merge(address indexed _owner, uint256 indexed _tokenId, uint256 indexed _targetTokenId, uint256 _mergeUnits);
    
    /**
     * @dev This emits when the approved units of the approved address for a token is set or changed.
     * @param _owner The address of the owner of the token
     * @param _approved The address of the approved operator
     * @param _tokenId The token to approve
     @ @param _approvalUnits The amount of approved units for the operator
     */
    event ApprovalUnits(address indexed _owner, address indexed _approved, uint256 indexed _tokenId, uint256 _approvalUnits);

    /**
     * @dev Find the slot of a token.
     * @param _tokenId The identifier for a token
     * @return The slot of the token
     */
    function slotOf(uint256 _tokenId)  external view returns(uint256);

    /**
     * @dev Count all tokens holding the same slot.
     * @param _slot The slot of which to count tokens
     * @return The number of tokens of the specified slot
     */
    function supplyOfSlot(uint256 _slot) external view returns (uint256);

    /**
     * @dev Find the number of decimals a token uses for units - e.g. 6, means the user representation of the units of a token can be calculated by dividing it by 1,000,000.
     * @return The number of decimals for units of a token
     */
    function unitDecimals() external view return (uint8);
    /**
     * @dev Enumerate all tokens of a slot.
     * @param _slot The slot of which to enumerate tokens
     * @param _index The index in the token list of the slot
     * @return The id for the `_index`th token in the token list of the slot
     */
    function tokenOfSlotByIndex(uint256 _slot, uint256 _index) external view returns (uint256);

    /**
     * @dev Find the amount of units of a token.
     * @param _tokenId The token to query units
     * @return The amount of units of `_tokenId`
     */
    function unitsInToken(uint256 _tokenId) external view returns (uint256);

    /**
     * @dev Set or change the approved units of an operator for a token.
     * @param _to The address of the operator to be approved
     * @param _tokenId The token to approve
     * @param _units The amount of approved units for the operator
     */
    function approve(address _to, uint256 _tokenId, uint256 _units) external;

    /**
     * @dev Find the approved units of an operator for a token.
     * @param _tokenId The token to find the operator for
     * @param _spender The address of an operator
     * @return The approved units of `_spender` for `_tokenId`
     */
    function allowance(uint256 _tokenId, address _spender) external view returns (uint256);

    /**
     * @dev Split a token into several by separating its units and assigning each portion to a new created token.
     * @param _tokenId The token to split
     * @param _units The amounts to split, i.e., the units of the new tokens created after split
     * @return The ids of the new tokens created after split
     */
    function split(uint256 _tokenId, uint256[] calldata _units) external returns (uint256[] memory);

    /**
     * @dev Merge several tokens into one by merging their units into a target token before burning them.
     * @param _tokenIds The tokens to merge
     * @param _targetTokenId The token to receive all units of the merged tokens
     */
    function merge(uint256[] calldata _tokenIds, uint256 _targetTokenId) external;

    /**
     * @dev Transfer units from a token to a newly created token. When transferring to a smart contract, the caller SHOULD check if the recipient is capable of receiving ERC-3525 token units.
     * @param _from The address of the owner of the token to transfer
     * @param _to The address of the owner the newly created token
     * @param _tokenId The token to partially transfer
     * @param _units The amount of units to transfer
     * @return The token created after transfer containing the transferred units
     */
    function transferFrom(address _from, address _to, uint256 _tokenId, uint256 _units) external returns (uint256);

    /**
     * @dev Transfer partial units of a token to a newly created token. If `_to` is a smart contract, this function MUST call `onERC3525Received` on `_to` after transferring and then verify the return value.
     * @param _from The address of the owner of the token to transfer
     * @param _to The address of the owner the newly created token
     * @param _tokenId The token to partially transfer
     * @param _units The amount of units to transfer
     * @param _data
     * @return The token created after transfer containing the transferred units
     */
    function safeTransferFrom(address _from, address _to, uint256 _tokenId, uint256 _units, bytes calldata _data) external returns (uint256);

    /**
     * @dev Transfer units from a token to another token. When transferring to a smart contract, the caller SHOULD check if the recipient is capable of receiving ERC-3525 token units.
     * @param _from The address of the owner of the token to transfer
     * @param _to The address of the owner the token to receive units
     * @param _tokenId The token to transfer units from
     * @param _targetTokenId The token to receive units
     * @param _units The amount of units to transfer
     */
    function transferFrom(address _from, address _to, uint256 _tokenId, uint256 _targetTokenId, uint256 _units) external;

    /**
     * @dev Transfer partial units of a token to an existing token. If `_to` is a smart contract, this function MUST call `onERC3525Received` on `_to` after transferring and then verify the return value.
     * @param _from The address of the owner of the token to transfer
     * @param _to The address of the owner the token to receive units
     * @param _tokenId The token to partially transfer
     * @param _targetTokenId The token to receive units
     * @param _units The amount of units to transfer
     * @param _data
     */
    function safeTransferFrom(address _from, address _to, uint256 _tokenId, uint256 _targetTokenId, uint256 _units, bytes calldata _data) external;
}