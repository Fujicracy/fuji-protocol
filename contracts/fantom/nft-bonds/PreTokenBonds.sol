// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./utils/VoucherCore.sol";
import "./NFTGame.sol";
import "./libraries/GameErrors.sol";
import "./interfaces/IVNFTDescriptor.sol";

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
  /**
   * @dev Vesting start timestamp changed
   */
  event VestingStartTimestampChanged(uint256 newVestingStartTimestamp);
  /**
   * @dev Admin deposit underlying tokens
   */
  event UnderlyingDeposit(uint256 amount);
  /**
   * @dev User claimed tokens
   */
  event UserClaim(address indexed user, uint256 amount);

  address private _owner;

  NFTGame public nftGame;
  bytes32 private _nftgame_GAME_ADMIN;
  bytes32 private _nftgame_GAME_INTERACTOR;

  address public underlying;
  uint256 public underlyingAmount;

  uint256[] private _bondSlotTimes;

  // _bondSlotTime => multiplier value
  mapping(uint256 => uint256) public bondSlotMultiplier;

  uint256 public bondPrice;

  uint256 public vestingStartTimestamp;

  bool public tgeActive;

  // Metadata for ERC3525 generated on Chain by 'voucherDescriptor'
  IVNFTDescriptor public voucherDescriptor;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {}

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(bytes4 interfaceId)
    public
    view
    override(AccessControlUpgradeable, ERC721EnumerableUpgradeable)
    returns (bool)
  {
    return
      interfaceId == type(IVNFT).interfaceId ||
      interfaceId == type(IERC721EnumerableUpgradeable).interfaceId ||
      interfaceId == type(IERC721MetadataUpgradeable).interfaceId ||
      // 'super.supportsInterface()' will read from  {AccessControlUpgradeable}
      super.supportsInterface(interfaceId);
  }

  function initialize(address _nftGame) external initializer {
    _owner = msg.sender;
    nftGame = NFTGame(_nftGame);
    uint8 decimals = uint8(nftGame.POINTS_DECIMALS());
    VoucherCore._initialize("FujiDAO PreToken Bonds", "fjBondVoucher", decimals);
    _nftgame_GAME_ADMIN = nftGame.GAME_ADMIN();
    _nftgame_GAME_INTERACTOR = nftGame.GAME_INTERACTOR();
    _bondSlotTimes = [1, 90, 180, 360];
    uint8[4] memory defaultMultipliers = [1, 1, 2, 4];
    uint256 length = _bondSlotTimes.length;
    for (uint256 i = 0; i < length; ) {
      bondSlotMultiplier[_bondSlotTimes[i]] = defaultMultipliers[i];
      unchecked {
        ++i;
      }
    }
    bondPrice = 10000 * 10 ** decimals;
    vestingStartTimestamp = nftGame.gamePhaseTimestamps(3) + 3650 days; 
  }

  /// View functions

  /**
   * @notice Returns the number of tokens per unit bond for a slotID (vesting time)
   */
  function tokensPerUnit(uint256 _slot) public view returns (uint256) {
    uint256 weightedUnits = _computeWeightedUnitAmounts();
    uint256 basicTokensPerUnit = underlyingAmount * 10 ** _unitDecimals / weightedUnits;
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
   * Example: '{_tokenBaseURI}/{tokenId}'
   * @dev See {IERC721Metadata-tokenURI}.
   */
  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
    return voucherDescriptor.tokenURI(tokenId);
  }

  /**
   * @notice Returns the contract URI for contract metadata
   * See {setContractURI(string)}
   */
  function contractURI() external view override returns (string memory) {
    return voucherDescriptor.contractURI();
  }

  /**
   * @notice Returns the slot ID URI for metadata
   * @dev Only if passed slot ID is valid.
   * Example: '{_slotBaseURI}/{slotID}'
   */
  function slotURI(uint256 slotID) external view override returns (string memory) {
    require(_checkIfSlotExists(slotID), "SlotID does not exist!");
    return voucherDescriptor.slotURI(slotID);
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
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(_nftGame != address(0), GameErrors.INVALID_INPUT);
    nftGame = NFTGame(_nftGame);
    _nftgame_GAME_ADMIN = nftGame.GAME_ADMIN();
    emit NFTGameChanged(_nftGame);
  }

  /**
   * @notice Admin restricted function to set address for bond claimaible
   * underlying Fuji ERC-20
   */
  function setUnderlying(address _underlying) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(_underlying != address(0), GameErrors.INVALID_INPUT);
    underlying = _underlying;
    emit UnderlyingChanged(_underlying);
  }

  /**
   * @notice Admin restricted function to push a new bond time.
   * @dev '_newbondSlotTime' should be different than existing bond times: Defaults: [1, 90, 180, 360]
   * @param _newbondSlotTime Value in months of new vesting time to push.
   * @param _newMultiplier Assigned multiplier for bond reward for '_newbondSlotTime'
   */
  function setBondVestingTimes(uint256 _newbondSlotTime, uint256 _newMultiplier) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(
      _newbondSlotTime > 0 &&
      _newMultiplier > 0 &&
      !_checkIfSlotExists(_newbondSlotTime),
      GameErrors.INVALID_INPUT
    );

    _bondSlotTimes.push(_newbondSlotTime);
    bondSlotMultiplier[_newbondSlotTime] = _newMultiplier;
    emit BondTimesChanges(_newbondSlotTime, _newMultiplier);
  }

  /**
   * @notice Admin restricted function to set bond price.
   * @dev Price is per (token id=0) points in {NFTGame} contract.
   */
  function setBondPrice(uint256 _bondPrice) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(_bondPrice > 0, GameErrors.INVALID_INPUT);
    bondPrice = _bondPrice;
    emit BondPriceChanges(_bondPrice);
  }

  /**
   * @notice Admin restricted function to set the vesting start timestamp
   */
  function setVestingStartTimeStamp(uint256 _vestingStartTimestamp) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(_vestingStartTimestamp > 0, GameErrors.INVALID_INPUT);
    vestingStartTimestamp = _vestingStartTimestamp;
    emit VestingStartTimestampChanged(_vestingStartTimestamp);
  }

  /**
   * @notice Admin restricted function to set state of tgeActive
   */
  function setTgeActive(bool _isActive) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    tgeActive = _isActive;
  }

  /**
   * @notice Admin restricted function to set the {VoucherDescriptor} contract that generates:
   * ContractURI metadata.
   * Slot ID metadata.
   * Token ID metadata.
   */
  function setVoucherDescriptor(address _voucherDescriptorAddr) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(_voucherDescriptorAddr != address(0), GameErrors.INVALID_INPUT);
    voucherDescriptor = IVNFTDescriptor(_voucherDescriptorAddr);
  }

  /**
   * @dev See 'owner()'
   */
  function setOwner(address _newOwner) public {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(_newOwner != address(0), GameErrors.INVALID_INPUT);
    _owner = _newOwner;
  }

  /// Change state functions

  /**
   * @notice Function to be called from Interactions contract, after burning the points
   * @dev Mint access restricted for users only via {NFTInteractions} contract or _nftgame_GAME_ADMIN
   * _units must include decimals.
   *
   */
  function mint(
    address _user,
    uint256 _slot,
    uint256 _units
  ) external returns (uint256 tokenID) {
    bool isGameAdmin = nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender);
    require(
      nftGame.hasRole(_nftgame_GAME_INTERACTOR, msg.sender) || isGameAdmin,
      GameErrors.NOT_AUTH
    );
    require(_units > 0 && _checkIfSlotExists(_slot), GameErrors.INVALID_INPUT);
    if (!isGameAdmin) {
      require(_slot != _bondSlotTimes[0], GameErrors.NOT_AUTH);
      uint256 phase = nftGame.getPhase();
      require(phase >= 2 && phase < 4, GameErrors.WRONG_PHASE);
    }
    tokenID = _mint(_user, _slot, _units);
  }

  /**
   * @notice Deposits Fuji ERC-20 tokens as underlying
   */
  function deposit(uint256 _amount) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(underlying != address(0), GameErrors.VALUE_NOT_SET);
    require(_amount > 0, GameErrors.INVALID_INPUT);
    IERC20 token = IERC20(underlying);
    require(token.allowance(msg.sender, address(this)) >= _amount, "No allowance!");
    token.transferFrom(msg.sender, address(this), _amount);
    underlyingAmount += _amount;
    tgeActive = true;
    emit UnderlyingDeposit(_amount);
  }

  /**
   * @notice Claims tokens at voucher expiry date.
   * @dev Msg.sender should be owner of tokenId.
   */
  function claim(uint256 _tokenId) external {
    require(ownerOf(_tokenId) == msg.sender, "Wrong owner!");
    require(underlying != address(0), GameErrors.VALUE_NOT_SET);
    uint256 slot = _slotOf(_tokenId);
    require(block.timestamp >= vestingTypeToTimestamp(slot), "Claiming not active yet");

    // 'units' and 'tokensPerBond' should be computed before voucher burn.
    uint256 units = unitsInToken(_tokenId);
    uint256 tokensPerBond = tokensPerUnit(slot);
    _burnVoucher(_tokenId);

    uint256 amountToTransfer = units * tokensPerBond / 10 ** _unitDecimals;
    underlyingAmount -= amountToTransfer;
    IERC20(underlying).transfer(msg.sender, amountToTransfer);
    emit UserClaim(msg.sender, amountToTransfer);
  }

  /**
   * @notice Returns the expiry date for bonds of voucher slot Id.
   * @dev This function requires to be public to be called by {VoucherDescriptor}.
   */
  function vestingTypeToTimestamp(uint256 _slotId) public view returns (uint256) {
    require(_checkIfSlotExists(_slotId), GameErrors.INVALID_INPUT);
    return vestingStartTimestamp + _slotId;
  }

  /// Internal functions

  /**
   * @notice Returns true if slot id exists.
   */
  function _checkIfSlotExists(uint256 _slot) internal view returns (bool exists) {
    // Next lines use the gas optmized form of loops.
    uint256[] memory localbondTimes = _bondSlotTimes;
    uint256 length = localbondTimes.length;
    for (uint256 i = 0; i < length; ) {
      if (_slot == localbondTimes[i]) {
        exists = true;
      }
      unchecked {
        ++i;
      }
    }
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
