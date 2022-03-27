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
  event BondTimesChanges(uint256 newBondTimes, uint256 newMultiplier);

  /**
   * @dev Bond price changed
   */
  event BondPriceChanges(uint256 newBondPrice);

  address private _owner;

  NFTGame private nftGame;

  address public underlying;

  uint256[] private _bondSlotTimes;

  // _bondSlotTime => multiplier value
  mapping(uint256 => uint256) public bondSlotMultiplier;

  uint256 public bondPrice;

  // Metadata for ERC3525:
  // Refer to: https://eips.ethereum.org/EIPS/eip-3525#metadata
  string private _tokenBaseURI; // ERC721 general base token URI
  string private _contractURI; // Contract Info URI
  string private _slotBaseURI; // Slot base URI

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(bytes4 interfaceId)
    public
    view
    override(AccessControlUpgradeable, ERC721Upgradeable)
    returns (bool)
  {
    return
      interfaceId == type(IVNFT).interfaceId ||
      interfaceId == type(IERC721Upgradeable).interfaceId ||
      interfaceId == type(IERC721MetadataUpgradeable).interfaceId ||
      // 'super.supportsInterface()' will read from  {AccessControlUpgradeable}
      super.supportsInterface(interfaceId);
  }

  function initialize(uint8 _unitDecimals, address _nftGame) external initializer {
    _owner = msg.sender;
    VoucherCore._initialize("FujiDAO PreToken Bonds", "fjVoucherBond", _unitDecimals);
    nftGame = NFTGame(_nftGame);
    _bondSlotTimes = [3, 6, 12];
    uint8[3] memory defaultMultipliers = [1,2,4];
    uint256 length = _bondSlotTimes.length;
    for (uint256 i = 0; i < length; ) {
      bondSlotMultiplier[_bondSlotTimes[i]] = defaultMultipliers[i];
      unchecked {
        ++i;
      }
    }
    bondPrice = 100000;
  }

  /// View functions

  /**
   * @notice Returns the number of tokens per unit bond for a slotID (vesting time)
   */
  function tokensPerUnit(uint256 _slot) public view returns (uint256) {
    uint256 WeightedUnits = _computeWeightedUnitAmounts();
    uint256 basicTokensPerUnit = IERC20(underlying).balanceOf(address(this)) / WeightedUnits;
    return basicTokensPerUnit * bondSlotMultiplier[_slot];
  }

  /**
   * @notice Returns the allowed Bond vesting times (slots).
   */
  function getBondVestingTimes() public view returns (uint256[] memory) {
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
  function contractURI() external view override returns (string memory) {
    return _contractURI;
  }

  /**
   * @notice Returns the slot ID URI for metadata
   * @dev Only if passed slot ID is valid.
   * Example: '{_slotBaseURI}/{slotID}.json'
   */
  function slotURI(uint256 slotID) external view override returns (string memory _uri) {
    uint256[] memory localSlots = _bondSlotTimes;
    for (uint256 index = 0; index < localSlots.length; index++) {
      if (localSlots[index] == slotID) {
        _uri = string(abi.encodePacked(_slotBaseURI, slotID.toString(), ".json"));
      }
    }
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
   * @notice Admin restricted function to push a new bond time.
   * @dev '_newbondSlotTime' should be different than existing bond times.
   * @param _newbondSlotTime Value in months of new vesting time to push.
   * Defaults: [3, 6, 12]
   */
  function setBondVestingTimes(uint256 _newbondSlotTime, uint256 _newMultiplier) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    require(_newbondSlotTime > 0 && _newMultiplier > 0, "No zero values!");
    require(!_checkIfSlotExists(_newbondSlotTime), "Bond slot exists!");

    _bondSlotTimes.push(_newbondSlotTime);
    bondSlotMultiplier[_newbondSlotTime] = _newMultiplier;
    emit BondTimesChanges(_newbondSlotTime, _newMultiplier);
  }

  /**
   * @notice Admin restricted function to set bond price.
   * @dev Price is per (token id=0) points in {NFTGame} contract.
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
   * @dev Mint access restricted for users only via {NFTInteractions} contract
   *
   */
  function mint(
    address _user,
    uint256 _slot,
    uint256 _units
  ) external returns (uint256 tokenID) {
    require(nftGame.hasRole(nftGame.GAME_INTERACTOR(), msg.sender), Errors.VL_NOT_AUTHORIZED);
    require(_units > 0, "Invalid amount!");
    require(_checkIfSlotExists(_slot), "Invalid slot!");
    uint256 phase = nftGame.getPhase();
    require(phase >= 2 && phase < 4, "Wrong game phase!");
    tokenID = _mint(_user, _slot, _units);
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
   * @dev Msg.sender should be owner of tokenId.
   */
  function claim(uint256 _tokenId) external {
    require(ownerOf(_tokenId) == msg.sender, "Wrong owner!");
    require(underlying != address(0), "Underlying not set");
    uint256 slot = _slotOf(_tokenId);
    require(block.timestamp >= _vestingTypeToTimestamp(slot), "Claiming not active yet");

    // 'units' and 'tokensPerBond' should be computed before voucher burn.
    uint256 units = unitsInToken(_tokenId);
    uint256 tokensPerBond = tokensPerUnit(slot);
    _burnVoucher(_tokenId);

    IERC20(underlying).transfer(msg.sender, units * tokensPerBond);
  }

  /// Internal functions

  /**
   * @notice Returns true if slot id exists.
   */
  function _checkIfSlotExists(uint256 _slot) internal view returns (bool exists) {
    // Next lines use the gas optmized form of loops.
    uint256[] memory localbondTimes = _bondSlotTimes;
    uint256 length = localbondTimes.length;
    for (uint256 index = 0; index < length; ) {
      if (_slot == localbondTimes[index]) {
        exists = true;
      }
      unchecked {
        ++index;
      }
    }
  }

  function _vestingTypeToTimestamp(uint256 _slot) internal view returns (uint256) {
    // _slot input can remained unchecked since is returned from '_slotOf()'.
    return nftGame.gamePhaseTimestamps(3) + (30 days * _slot);
  }

  function _computeWeightedUnitAmounts() internal view returns (uint256 weightedTotal) {
    uint256 length = _bondSlotTimes.length;
    for (uint256 i = 0; i < length; ) {
      weightedTotal += unitsInSlot(_bondSlotTimes[i]) * bondSlotMultiplier[_bondSlotTimes[i]];
      unchecked {
        ++i;
      }
    }
  }
}
