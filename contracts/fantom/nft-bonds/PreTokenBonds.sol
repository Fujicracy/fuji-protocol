// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../../abstracts/claimable/ClaimableUpgradeable.sol";
import "./utils/VoucherCore.sol";
import "./NFTGame.sol";

contract PreTokenBonds is VoucherCore, AccessControlUpgradeable, ClaimableUpgradeable {
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

  uint256[] public bondTimes;

  uint256 public bondPrice;

  string private _contractURI;

  // SlotID => to URI mapping
  mapping(uint256 => string) private _slotURI;

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
  ) external {
    // Claimable contract is added to have 'owner()' function required to update
    // update and control external NFT front-ends.
    __Claimable_init();
    VoucherCore._initialize(_name, _symbol, _unitDecimals);
    nftGame = NFTGame(_nftGame);
    bondTimes = [3, 6, 12];
    bondPrice = 10000;
  }

  /// View functions


  /**
   * @notice Returns the number of tokens per bond for a slotID (vesting time)
   */
  function tokensPerUnit(uint256 _slot) public view returns(uint256) {
    uint256 totalUnits = 0;
    for (uint256 i = 0; i < bondTimes.length; i++) {
      totalUnits += unitsInSlot(bondTimes[i]);
    }
    uint256 slot = bondTimes[_slot];
    uint256 multiplier = slot == 3 ? 1 : slot == 6 ? 2 : 4;
    return (IERC20(underlying).balanceOf(address(this)) * multiplier  / totalUnits);
  } 

  /**
   * @notice Returns the contract URI for contract metadata
   */
  function contractURI() external override view returns (string memory) {
    return _contractURI;
  }

  /**
   * @notice Returns the slot URI for metadata
   * @param slot: slot id to request URI
   */
  function slotURI(uint256 slot) external override view returns (string memory) {
    return _slotURI[slot];
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
  function setBondTimes(uint256[] memory _bondTimes) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    bondTimes = _bondTimes;
    emit BondTimesChanges(_bondTimes);
  }

  /**
   * @notice Set bond price
   */
  function setBondTimes(uint256 _bondPrice) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    bondPrice = _bondPrice;
    emit BondPriceChanges(_bondPrice);
  }

  /**
   * @notice Set the contract URI
   */
  function setContractURI(string calldata _URI) external {
    _contractURI = _URI;
  }

  /**
   * @notice Set the URI for a slotID
   */
  function setSlotURI(uint256 _slot, string calldata _URI) external {
    _slotURI[_slot] = _URI;
  }

  /// Change state functions

  /**
   * @notice Function to be called from Interactions contract, after burning the points
   */
  function mint(address _user, uint256 _type, uint256 _units) external {
    require(nftGame.hasRole(nftGame.GAME_INTERACTOR(), msg.sender), "No permission!");
    _mint(_user, bondTimes[_type], _units);
  }

  /**
   * @notice Deposits Fuji ERC-20 tokens as underlying
   */
  function deposit(uint256 _amount) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    require(underlying != address(0), "Underlying not set");
    IERC20(underlying).transferFrom(msg.sender, address(this), _amount);
  }

  function claim(address user, uint256 _type, uint256 _units) external {
    require(underlying != address(0), "Underlying not set");
    //TODO check date (create new phase?)
    //TODO check units
    //TODO burn units

    IERC20(underlying).transfer(user, tokensPerUnit(_type) * _units);
  }   
}