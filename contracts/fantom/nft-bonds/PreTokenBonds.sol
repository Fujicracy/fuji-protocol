// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./utils/VoucherCore.sol";
import "./NFTGame.sol";
import "../../libraries/Errors.sol";

contract PreTokenBonds is VoucherCore, AccessControlUpgradeable {
  using StringsUpgradeable for uint256;

  /**
   * @dev NFTGame contract address changed
   */
  event NFTGameChanged(address newAddress);

  /**
   * @dev Underlying token address changed
   */
  event UnderlyingChanged(address newAddress);

  /**
   * @dev Bond times changed
   */
  event BondTimesChanges(uint256[] newBondTimes);

  /**
   * @dev Bond price changed
   */
  event BondPriceChanges(uint256 newBondPrice);

  enum SlotVestingTypes {
    months3,
    months6,
    months12
  }

  address private _owner;

  NFTGame private nftGame;

  address public underlying;

  uint256[] private _bondSlotTimes;

  uint256 public bondPrice;

  // Metadata for ERC3525:
  // Refer to: https://eips.ethereum.org/EIPS/eip-3525#metadata
  string private _tokenBaseURI; // ERC721 general base token URI
  string private _contractURI; // Contract Info URI 
  string private _slotBaseURI; // Slot base URI 

  /**
  * @dev See {IERC165-supportsInterface}.
  */
  function supportsInterface(bytes4 interfaceId) public view 
    override(AccessControlUpgradeable, ERC721Upgradeable) returns (bool) {
      return
        interfaceId == type(IVNFT).interfaceId ||
        interfaceId == type(IERC721Upgradeable).interfaceId ||
        interfaceId == type(IERC721MetadataUpgradeable).interfaceId ||
        // 'super.supportsInterface()' will read from  {AccessControlUpgradeable}
        super.supportsInterface(interfaceId); 
  }

  function initialize(
      uint8 _unitDecimals,
      address _nftGame
  ) external initializer {
    _owner = msg.sender;
    VoucherCore._initialize("FujiDAO PreToken Bonds", "fjVoucherBond", _unitDecimals);
    nftGame = NFTGame(_nftGame);
    _bondSlotTimes = [3, 6, 12];
    bondPrice = 100000;
  }

  /// View functions

  /**
   * @notice Returns the number of tokens per bond for a slotID (vesting time)
   */
  function tokensPerUnit(SlotVestingTypes _slot) public view returns(uint256) {
    uint256 totalUnits = 0;
    for (uint256 i = 0; i < _bondSlotTimes.length; i++) {
      totalUnits += unitsInSlot(_bondSlotTimes[i]);
    }
    uint256 slot = _bondSlotTimes[uint256(_slot)];
    uint256 multiplier = slot == 3 ? 1 : slot == 6 ? 2 : 4;
    return (IERC20(underlying).balanceOf(address(this)) * multiplier  / totalUnits);
  }

  /**
   * @notice Returns the allowed Bond vesting times (slots).
   */
  function getBondVestingTimes() public view returns(uint256[] memory) {
    return _bondSlotTimes;
  }

  /**
  * @notice Returns the token Id metadata URI
  * Example: '{_tokenBaseURI}/{tokenId}.json'
  * @dev See {IERC721Metadata-tokenURI}.
  */
  function tokenURI(uint256 tokenId) public view override returns (string memory) {
      require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
      return string(abi.encodePacked(_tokenBaseURI, tokenId.toString(), ".json"));
  }

  /**
   * @notice Returns the contract URI for contract metadata
   * See {setContractURI(string)}
   */
  function contractURI() external override view returns (string memory) {
    return _contractURI;
  }

  /**
   * @notice Returns the slot ID URI for metadata
   * Example: '{_slotBaseURI}/{slotID}.json'
   */
  function slotURI(uint256 slotID) external override view returns (string memory) {
    require(
      slotID == uint256(SlotVestingTypes.months3) ||
      slotID == uint256(SlotVestingTypes.months6) ||
      slotID == uint256(SlotVestingTypes.months12),
      "Only accept: 0, 1, 2"
       );
    return string(abi.encodePacked(_slotBaseURI, slotID.toString(), ".json"));
  }

  /**
   * @notice Returns the owner that can manage external NFT-marketplace front-ends.
   * @dev This view function is required to allow an EOA
   * to manage some front-end features in websites like: OpenSea, Rarible, etc
   * This 'owner()' does not have any game-admin role.
   */
  function owner() external view returns (address) {
    return _owner;
  }

  /// Administrative functions

  /**
   * @notice Admin restricted function to set address for NFTGame contract
   */
  function setNFTGame(address _nftGame) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    require(_nftGame != address(0), Errors.VL_ZERO_ADDR);
    nftGame = NFTGame(_nftGame);
    emit NFTGameChanged(_nftGame);
  }

  /**
   * @notice Admin restricted function to set address for bond claimaible 
   * underlying Fuji ERC-20
   */
  function setUnderlying(address _underlying) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    require(_underlying != address(0), Errors.VL_ZERO_ADDR);
    underlying = _underlying;
    emit UnderlyingChanged(_underlying);
  }
  
  /**
   * @notice Admin restricted function to set bond times.
   * @param _newbondSlotTimes Array of values in months for vesting time.
   * Example: [3, 6, 12]
   */
  function setBondVestingTimes(uint256[] calldata _newbondSlotTimes) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    for (uint256 index = 0; index < _newbondSlotTimes.length; index++) {
      require(_newbondSlotTimes[index] > 0, "No zero values!");
    }
    _bondSlotTimes = _newbondSlotTimes;
    emit BondTimesChanges(_bondSlotTimes);
  }

  /**
   * @notice Admin restricted function to set bond price.
   * @dev Price is in relation to token id=0 (points) in {NFTGame} contract.
   */
  function setBondPrice(uint256 _bondPrice) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    require(_bondPrice > 0, "No zero value!");
    bondPrice = _bondPrice;
    emit BondPriceChanges(_bondPrice);
  }

  /**
   * @notice Admin restricted function to set the base URI for a Token ID metadata
   * @dev example input: 'https://www.mysite.com/metadata/token/'
   */
  function setBaseTokenURI(string calldata _URI) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    _slotBaseURI = _URI;
  }

  /**
   * @notice Admin restricted function to set the contract general URI metadata
   * @dev example input: 'https://www.mysite.com/metadata/contractERC3525.json'
   */
  function setContractURI(string calldata _URI) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    _contractURI = _URI;
  }

  /**
   * @notice Admin restricted function to set the base URI for a slot ID metadata
   * @dev example input: 'https://www.mysite.com/metadata/slots/'
   */
  function setBaseSlotURI(string calldata _URI) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    _slotBaseURI = _URI;
  }

  /**
   * @dev See 'owner()'
   */
  function setOwner(address _newOwner) public {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    require(_newOwner != address(0), Errors.VL_ZERO_ADDR);
    _owner = _newOwner;
  }

  /// Change state functions

  /**
   * @notice Function to be called from Interactions contract, after burning the points
   * @dev Mint access restricted only via {NFTInteractions} contract
   * '_units' > 0 is checked at {NFTInteractions}
   */
  function mint(address _user, SlotVestingTypes _type, uint256 _units) external returns (uint256 tokenID) {
    require(nftGame.hasRole(nftGame.GAME_INTERACTOR(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    tokenID = _mint(_user,  _bondSlotTimes[uint256(_type)], _units);
  }

  /**
   * @notice Deposits Fuji ERC-20 tokens as underlying
   */
  function deposit(uint256 _amount) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    require(underlying != address(0), "Underlying not set");
    require(_amount > 0, "Zero amount!");
    IERC20 token = IERC20(underlying);
    require(token.allowance(msg.sender, address(this)) >= _amount, "No allowance!");
    token.transferFrom(msg.sender, address(this), _amount);
  }

  /**
   * @notice Claims tokens at voucher expiry date.
   */
  function claim(uint256 _tokenId) external {
    require (ownerOf(_tokenId) == msg.sender, "No permission");
    require(underlying != address(0), "Underlying not set");
    SlotVestingTypes vestingType = SlotVestingTypes(_slotOf(_tokenId));
    require (block.timestamp >= vestingTypeToTimestamp(vestingType), "Claiming not active yet");

    uint256 units = unitsInToken(_tokenId);
    _burnVoucher(_tokenId);

    IERC20(underlying).transfer(msg.sender, tokensPerUnit(vestingType) * units);
  }

  // Intenral functions

  function vestingTypeToTimestamp(SlotVestingTypes _slot) view internal returns (uint256) {
    return nftGame.gamePhaseTimestamps(3) + (30 days * _bondSlotTimes[uint256(_slot)]); 
  }
}