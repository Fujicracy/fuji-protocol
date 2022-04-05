// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title NFT Interactions
/// @author fuji-dao.eth

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./NFTGame.sol";
import "./libraries/GameErrors.sol";
import "./libraries/LibPseudoRandom.sol";
import "./FujiPriceAware.sol";
import "./PreTokenBonds.sol";
import "../../interfaces/chainlink/AggregatorV3Interface.sol";

contract NFTInteractions is FujiPriceAware, ReentrancyGuardUpgradeable {
  /**
   * @dev Reward for opening a crate, 'tokenId' corresponds to ERC1155 ids
   */
  struct Reward {
    uint256 tokenId;
    uint256 amount;
  }

  /**
   * @dev Changing a crate points price
   */
  event CratePriceChanged(uint256 crateId, uint256 price);

  /**
   * @dev Changing a card boost
   */
  event CardBoostChanged(uint256 cardId, uint256 boost);

  /**
   * @dev Changing crate rewards
   */
  event CrateRewardsChanged(uint256 crateId, uint256[] rewards);

  /**
   * @dev Acquired crates
   */
  event CratesAcquired(uint256 crateId, uint256 amount);

  /**
   * @dev Opened crates
   */
  event CratesOpened(address user, uint256 crateId, Reward[] rewards);

  /**
   * @dev Final score locked
   */
  event LockedScore(address indexed user, uint256 lockedNFTId);

  /**
   * @dev NFTGame contract address changed
   */
  event NFTGameChanged(address newAddress);

  /**
   * @dev PreTokenBonds contract address changed
   */
  event PreTokenBondsChanged(address newAddress);

  uint256 public constant CRATE_COMMON_ID = 1;
  uint256 public constant CRATE_EPIC_ID = 2;
  uint256 public constant CRATE_LEGENDARY_ID = 3;
  uint256 public constant NFT_CARD_ID_START = 4;
  bool public isRedstoneOracleOn;

  // CrateID => crate rewards
  mapping(uint256 => uint256[]) private _crateRewards;

  uint256[] private _probabilityIntervals;

  NFTGame public nftGame;
  uint256 private _pointsID;
  bytes32 private _nftgame_GAME_ADMIN;

  PreTokenBonds public preTokenBonds;

  // CrateID => crate price
  mapping(uint256 => uint256) public cratePrices;

  // CardID => boost: where boost is a base 100 number.
  mapping(uint256 => uint256) public cardBoost;

  function initialize(address _nftGame) external initializer {
    __ReentrancyGuard_init();
    isRedstoneOracleOn = true;
    maxDelay = 5 * 60;
    nftGame = NFTGame(_nftGame);

    // '_pointsID' and '_nftgame_GAME_ADMIN'
    // are stored locally to reduce contract size.
    _pointsID = nftGame.POINTS_ID();
    _nftgame_GAME_ADMIN = nftGame.GAME_ADMIN();

    _probabilityIntervals = [500000, 700000, 900000, 950000, 950100];

    // Set basic cardBoost
    uint256 cardsLimit = nftGame.nftCardsAmount() + NFT_CARD_ID_START;
    for (uint256 i = NFT_CARD_ID_START; i < cardsLimit;) {
      cardBoost[i] = 10;
      unchecked {
        ++i;
      }
    }
  }

  // Admin functions

  /**
   * @notice Set address for NFTGame contract
   */
  function setNFTGame(address _nftGame) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    nftGame = NFTGame(_nftGame);
    emit NFTGameChanged(_nftGame);
  }

  function setPreTokenBonds(address _preTokenBonds) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    preTokenBonds = PreTokenBonds(_preTokenBonds);
    emit PreTokenBondsChanged(_preTokenBonds);
  }

  /**
   * @notice sets the prices for the crates
   */
  function setCratePrice(uint256 crateId, uint256 price) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(
      crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID,
      GameErrors.INVALID_INPUT
    );
    cratePrices[crateId] = price;
    emit CratePriceChanged(crateId, price);
  }

  /**
   * @notice sets probability intervals for crate rewards
   */
  function setProbabilityIntervals(uint256[] memory intervals) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    _probabilityIntervals = intervals;
  }

  /**
   * @notice sets crate rewards
   * rewards are an array, with each element corresponding to the points multiplier value
   */
  function setCrateRewards(uint256 crateId, uint256[] memory rewards) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    _crateRewards[crateId] = rewards;
    emit CrateRewardsChanged(crateId, rewards);
  }

  /**
   * @notice sets card boost rewards
   * @dev Global boost is a base 100 number.
   */
  function setCardBoost(uint256 cardId, uint256 boost) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(boost > 0, GameErrors.INVALID_INPUT);
    cardBoost[cardId] = boost;
    emit CardBoostChanged(cardId, boost);
  }

  /**
   * @notice sets allowed signer address of entropy feed.
   * Admin function required by redstone-evm-connector (oracle).
   */
  function authorizeSignerEntropyFeed(address _trustedSigner) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    _authorizeSigner(_trustedSigner);
  }

  /**
   * @notice sets max allowed delay between front-end call and entropy feed.
   * Admin function required by redstone-evm-connector (oracle).
   */
  function setMaxEntropyDelay(uint256 _maxDelay) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    _setMaxDelay(_maxDelay);
  }

  /**
   * @notice Toggle between oracles for entropy.
   * switch(1) = redstone, switch(0) = chainlink
   */
  function setIsRedstoneOracleOn(bool switch_) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    isRedstoneOracleOn = switch_;
  }

  /// Interaction Functions

  /**
   * @notice mints new bonds
   * @param _slotType: the vesting slot (based on time) associated with the bond
   * @param amount: number of bonds to be minted
   * @dev '_slotType' input validations is done in {PreTokenBonds} contract.
   */
  function mintBonds(uint256 _slotType, uint256 amount) external nonReentrant returns(uint256 tokenId) {
    require(_isLocked(msg.sender), GameErrors.USER_LOCK_ERROR);
    require(amount > 0, GameErrors.INVALID_INPUT);

    uint256 cost = amount * preTokenBonds.bondPrice();
    require(nftGame.balanceOf(msg.sender, _pointsID) >= cost, GameErrors.NOT_ENOUGH_AMOUNT);

    nftGame.burn(msg.sender, _pointsID, cost);
    tokenId = preTokenBonds.mint(msg.sender, _slotType, amount);
  }

  /**
   * @notice Burns user points to mint a new crate
   */
  function mintCrates(uint256 crateId, uint256 amount) external nonReentrant {
    // accumulation and trading only
    uint256 phase = nftGame.getPhase();
    require(phase > 0 && phase < 3, GameErrors.WRONG_PHASE);
    require(!_isLocked(msg.sender), GameErrors.USER_LOCK_ERROR);
    require(amount > 0, GameErrors.INVALID_INPUT);

    require(
      crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID,
      GameErrors.INVALID_INPUT
    );

    uint256 price = cratePrices[crateId] * amount;
    require(price > 0, GameErrors.VALUE_NOT_SET);
    require(nftGame.balanceOf(msg.sender, _pointsID) >= price, GameErrors.NOT_ENOUGH_AMOUNT);

    nftGame.burn(msg.sender, _pointsID, price);

    nftGame.mint(msg.sender, crateId, amount);

    emit CratesAcquired(crateId, amount);
  }

  /**
   * @notice opens crates with the given id
   */
  function openCrate(uint256 crateId, uint256 amount) external nonReentrant {
    // accumulation and trading only
    uint256 phase = nftGame.getPhase();
    require(phase > 0 && phase < 3, GameErrors.WRONG_PHASE);
    require(!_isLocked(msg.sender), GameErrors.USER_LOCK_ERROR);
    require(amount > 0, GameErrors.INVALID_INPUT);

    require(
      crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID,
      GameErrors.INVALID_INPUT
    );
    require(nftGame.balanceOf(msg.sender, crateId) >= amount, GameErrors.NOT_ENOUGH_AMOUNT);
    require(_crateRewards[crateId].length == _probabilityIntervals.length, GameErrors.VALUE_NOT_SET);

    // Points + Crates + Cards
    uint256 cardsAmount = nftGame.nftCardsAmount();
    Reward[] memory rewards = new Reward[](amount);
    uint256[] memory aggregatedRewards = new uint256[](1 + 3 + cardsAmount);

    uint256 entropyValue = isRedstoneOracleOn ? _getRedstoneEntropy() : _getChainlinkEntropy();
    uint256[] memory randomNumbers = LibPseudoRandom.pickRandomNumbers(amount, entropyValue);
    bool isCard;

    // iterate all crates to open
    uint256 plength = _probabilityIntervals.length;
    uint256 pointsID = _pointsID;
    for (uint256 j = 0; j < amount;) {
      isCard = true;
      // iterate propability intervals to see the reward for a specific crate
      for (uint256 i = 0; i < plength && isCard;) {
        if (randomNumbers[j] <= _probabilityIntervals[i]) {
          isCard = false;
          aggregatedRewards[pointsID] += _crateRewards[crateId][i];
          rewards[j].amount = _crateRewards[crateId][i];
        }
        unchecked {
          ++i;
        }
      }

      // if the reward is a card determine the card id
      if (isCard) {
        uint256 step = 1000000 / cardsAmount;
        uint256 randomNum = LibPseudoRandom.pickRandomNumbers(1, entropyValue + j)[0];
        uint256 randomId = NFT_CARD_ID_START;
        for (uint256 i = step; i <= randomNum; i += step) {
          randomId++;
        }
        aggregatedRewards[randomId]++;
        rewards[j].tokenId = randomId;
        rewards[j].amount = 1;
      }
      unchecked {
        ++j;
      }
    }

    // mint points
    if (aggregatedRewards[pointsID] > 0) {
      nftGame.mint(msg.sender, pointsID, aggregatedRewards[pointsID]);
    }

    // mint cards
    uint256 cardsLimit = cardsAmount + NFT_CARD_ID_START;
    for (uint256 i = NFT_CARD_ID_START; i < cardsLimit;) {
      if (aggregatedRewards[i] > 0) {
        nftGame.mint(msg.sender, i, aggregatedRewards[i]);
      }
      unchecked {
        ++i;
      }
    }

    // burn opened crates
    nftGame.burn(msg.sender, crateId, amount);

    emit CratesOpened(msg.sender, crateId, rewards);
  }

  function lockFinalScore() external {
    // trading-phase only
    uint256 phase = nftGame.getPhase();
    require(phase >= 2, GameErrors.WRONG_PHASE);
    uint256 boostNumber = computeBoost(msg.sender);
    uint256 lockedNFTId = nftGame.userLock(msg.sender, boostNumber);

    // Emit locking event
    emit LockedScore(msg.sender, lockedNFTId);
  }

  /// Read-only functions

  /**
   * @notice Returns the probability intervals
   */
  function getProbabilityIntervals() external view returns (uint256[] memory) {
    return _probabilityIntervals;
  }

  /**
   * @notice Returns the rewards for a specific crate
   */
  function getCrateRewards(uint256 crateId) external view returns (uint256[] memory) {
    return _crateRewards[crateId];
  }

  /**
   * @notice Returns the totalBoost of user according to cards in possesion.
   * @dev Value is 100 based. In example; 150 is +50% or 1.5 in decimal
   */
  function computeBoost(address user) public view returns (uint256 totalBoost) {
    totalBoost = 100;
    uint256 cardLimit = NFT_CARD_ID_START + nftGame.nftCardsAmount();
    for (uint256 i = NFT_CARD_ID_START; i < cardLimit;) {
      if (nftGame.balanceOf(user, i) > 0) {
        totalBoost += cardBoost[i];
      }
      unchecked {
        ++i;
      }
    }
  }

  /// Internal functions

  /**
   * @notice returns true if user is already locked.
   */
  function _isLocked(address user) internal view returns (bool locked) {
    (, , , , uint256 lockedID) = nftGame.userdata(user);
    if (lockedID != 0) {
      locked = true;
    }
  }

  /**
   * @notice calls redstone-oracle for entropy value.
   */
  function _getRedstoneEntropy() private view returns (uint256) {
    return _getPriceFromMsg(bytes32("ENTROPY"));
  }

  /**
   * @notice calls chainlink-oracle for entropy value.
   */
  function _getChainlinkEntropy() private view returns (uint256) {
    // Hardcoded for fantom
    (, int256 numA, , , ) = AggregatorV3Interface(0xf4766552D15AE4d256Ad41B6cf2933482B0680dc)
      .latestRoundData();
    (, int256 numB, , , ) = AggregatorV3Interface(0x11DdD3d147E5b83D01cee7070027092397d63658)
      .latestRoundData();
    return uint256(numA * numB);
  }
}
