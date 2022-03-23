// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../../abstracts/claimable/ClaimableUpgradeable.sol";
import "./utils/VoucherCore.sol";
import "./NFTGame.sol";

contract PreTokenBonds is VoucherCore, AccessControlUpgradeable, ClaimableUpgradeable {
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
        interfaceId == type(IAccessControlUpgradeable).interfaceId ||
        interfaceId == type(IERC721Upgradeable).interfaceId ||
        interfaceId == type(IERC721MetadataUpgradeable).interfaceId ||
        super.supportsInterface(interfaceId);
  }

  function initialize(
      string memory _name,
      string memory _symbol,
      uint8 _unitDecimals,
      address _nftGame
  ) external initializer {
    // Claimable contract is added to have 'owner()' function required to update
    // update and control external NFT front-ends.
    __Claimable_init();
    VoucherCore._initialize(_name, _symbol, _unitDecimals);
    nftGame = NFTGame(_nftGame);
    _bondSlotTimes = [3, 6, 12];
    bondPrice = 10000;
  }

  /// View functions

  /**
   * @notice Returns the number of tokens per bond for a slotID (vesting time)
   */
  function tokensPerUnit(uint256 _slot) public view returns(uint256) {
    uint256 totalUnits = 0;
    for (uint256 i = 0; i < _bondSlotTimes.length; i++) {
      totalUnits += unitsInSlot(_bondSlotTimes[i]);
    }
    uint256 slot = _bondSlotTimes[_slot];
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
    return string(abi.encodePacked(_slotBaseURI, slotID.toString(), ".json"));
  }

  /// Administrative functions

  /**
   * @notice Set address for NFTGame contract
   */
  function setNFTGame(address _nftGame) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    nftGame = NFTGame(_nftGame);
    emit NFTGameChanged(_nftGame);
  }

  /**
   * @notice Set address for underlying Fuji ERC-20
   */
  function setUnderlying(address _underlying) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    underlying = _underlying;
    emit UnderlyingChanged(_underlying);
  }
  
  /**
   * @notice Set bond times
   */
  function setBondTimes(uint256[] calldata _newbondSlotTimes) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    _bondSlotTimes = _newbondSlotTimes;
    emit BondTimesChanges(_bondSlotTimes);
  }

  /**
   * @notice Set bond price
   */
  function setBondPrice(uint256 _bondPrice) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    bondPrice = _bondPrice;
    emit BondPriceChanges(_bondPrice);
  }

  /**
   * @notice Set the base URI for a Token ID metadata
   * @dev example input: 'https://www.mysite.com/metadata/token/'
   */
  function setBaseTokenURI(string calldata _URI) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    _slotBaseURI = _URI;
  }

  /**
   * @notice Set the contract general URI metadata
   * @dev example input: 'https://www.mysite.com/metadata/contractERC3525.json'
   */
  function setContractURI(string calldata _URI) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    _contractURI = _URI;
  }

  /**
   * @notice Set the base URI for a slot ID metadata
   * @dev example input: 'https://www.mysite.com/metadata/slots/'
   */
  function setBaseSlotURI(string calldata _URI) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    _slotBaseURI = _URI;
  }

  /// Change state functions

  /**
   * @notice Function to be called from Interactions contract, after burning the points
   */
  function mint(address _user, uint256 _type, uint256 _units) external {
    require(nftGame.hasRole(nftGame.GAME_INTERACTOR(), msg.sender), "No permission!");
    _mint(_user, _bondSlotTimes[_type], _units);
  }

  /**
   * @notice Deposits Fuji ERC-20 tokens as underlying
   */
  function deposit(uint256 _amount) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    require(underlying != address(0), "Underlying not set");
    IERC20(underlying).transferFrom(msg.sender, address(this), _amount);
  }

  /**
   * @notice Claims tokens at voucher expiry date.
   */
  function claim(address user, uint256 _type, uint256 _units) external {
    require(underlying != address(0), "Underlying not set");
    //TODO check date (create new phase?)
    //TODO check units
    //TODO burn units

    IERC20(underlying).transfer(user, tokensPerUnit(_type) * _units);
  }
}