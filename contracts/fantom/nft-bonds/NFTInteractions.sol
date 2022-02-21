// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @title NFT Interactions
/// @author fuji-dao.eth

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./NFTGame.sol";
import "../libraries/LibPseudoRandom.sol";
import "./FujiPriceAware.sol";

contract NFTInteractions is FujiPriceAware, Initializable {
  using LibPseudoRandom for uint256;

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
  event CratesOpened(uint256 crateId, uint256 amount);

  /**
   * @dev Final score locked
   */
  event LockedScore(address indexed user, uint256 lockedNFTId);

  uint256 public constant CRATE_COMMON_ID = 1;
  uint256 public constant CRATE_EPIC_ID = 2;
  uint256 public constant CRATE_LEGENDARY_ID = 3;
  uint256 public constant NFT_CARD_ID_START = 4;
  uint256 public constant NFT_CARD_ID_END = 11;

  // CrateID => crate rewards
  mapping(uint256 => uint256[]) crateRewards;
  
  uint256[] private probabilityIntervals;

  NFTGame private nftGame;

  // CrateID => crate price
  mapping(uint256 => uint256) public cratePrices;

  // CardID => boost: where boost is a base 100 number.
  mapping(uint256 => uint256) public cardBoost;

  function initialize(address _nftGame) external initializer {
    maxDelay = 3 * 60;
    nftGame = NFTGame(_nftGame);
    probabilityIntervals = [500000, 700000, 900000, 950000, 950100];
  }

  // Admin functions

  /**
  * @notice Set address for NFTGame contract
  */
  function setNFTGame(address _nftGame) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    nftGame = NFTGame(_nftGame);
  }

  /**
  * @notice sets the prices for the crates
  */
  function setCratePrice(uint256 crateId, uint256 price) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    require(crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID, "Invalid crate ID!");
    cratePrices[crateId] = price;
    emit CratePriceChanged(crateId, price);
  }

  /**
  * @notice sets probability intervals for crate rewards
  */
  function setProbabilityIntervals(uint256[] memory intervals) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    probabilityIntervals = intervals;
  }

  /**
  * @notice sets crate rewards
  * rewards are an array, with each element corresponding to the points multiplier value
  */
  function setCrateRewards(uint256 crateId, uint256[] memory rewards) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    crateRewards[crateId] = rewards;
    emit CrateRewardsChanged(crateId, rewards);
  }

  /**
  * @notice sets card boost rewards
  * @dev boost is a base 100 number. In example, boost = 115, 15% boost. 1.15 for computation. 
  */
  function setCardBoost(uint256 cardId, uint256 boost) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    require(boost >= 100, "Boost not > 100!");
    cardBoost[cardId] = boost;
    emit CardBoostChanged(cardId, boost);
  }

  /**
   * @notice sets allowed signer address of entropy feed.
   * Admin function required by redstone-evm-connector (oracle).
   */
  function authorizeSignerEntropyFeed(address _trustedSigner) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    _authorizeSigner(_trustedSigner);
  }

  /**
   * @notice sets max allowed delay between front-end call and entropy feed.
   * Admin function required by redstone-evm-connector (oracle).
   */
  function setMaxEntropyDelay(uint256 _maxDelay) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    _setMaxDelay(_maxDelay);
  }

  /// Interaction Functions

  /**
   * @notice Burns user points to mint a new crate
   */
  function mintCrates(uint256 crateId, uint256 amount) external {
    // accumulation and trading only
    uint256 phase = nftGame.getPhase();
    require(phase > 0 && phase < 3, "wrong game phase!");

    require(
      crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID,
      "Invalid crate ID!"
    );

    uint256 price = cratePrices[crateId] * amount;
    require(price > 0, "Price not set");
    require(nftGame.balanceOf(msg.sender, nftGame.POINTS_ID()) >= price, "Not enough points!");

    nftGame.burn(msg.sender, nftGame.POINTS_ID(), price);

    nftGame.mint(msg.sender, crateId, amount);

    emit CratesAcquired(crateId, amount);
  }

  /**
   * @notice opens one crate with the given id
   */
  function openCrate(uint256 crateId, uint256 amount) external {
    // accumulation and trading only
    uint256 phase = nftGame.getPhase();
    require(phase > 0 && phase < 3, "wrong game phase!");

    require(
      crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID,
      "Invalid crate ID!"
    );
    require(nftGame.balanceOf(msg.sender, crateId) >= amount, "Not enough crates!");
    require(crateRewards[crateId].length == probabilityIntervals.length, "Rewards not set!");

    uint256 pointsAmount = 0;
    uint256[NFT_CARD_ID_END - NFT_CARD_ID_START + 1] memory cardsAmount;

    uint256 entropyValue = _getEntropy();
    uint256[] memory randomNumbers = LibPseudoRandom.pickRandomNumbers(amount, entropyValue);
    bool isCard;

    // iterate all crates to open
    for (uint256 j = 0; j < amount; j++) {
      isCard = true;
      // iterate propability intervals to see the reward for a specific crate
      for (uint256 i = 0; i < probabilityIntervals.length && isCard; i++) {
        if (randomNumbers[j] <= probabilityIntervals[i]) {
          isCard = false;
          pointsAmount += crateRewards[crateId][i];
        }
      }

      // if the reward is a card determine the card id
      if (isCard) {
        uint256 step = 1000000 / (NFT_CARD_ID_END - NFT_CARD_ID_START + 1);
        uint256 randomNum = LibPseudoRandom.pickRandomNumbers(1, entropyValue + 1)[0];
        uint256 randomId = 0;
        for (uint256 i = step; i <= randomNum; i += step) {
          randomId++;
        }
        cardsAmount[randomId]++;
      }
    }

    // mint points
    if (pointsAmount > 0) {
      nftGame.mint(msg.sender, nftGame.POINTS_ID(), pointsAmount);
    }

    // mint cards
    for (uint256 i = 0; i < cardsAmount.length; i++) {
      if (cardsAmount[i] > 0) {
        nftGame.mint(msg.sender, i + NFT_CARD_ID_START, cardsAmount[i]);
      }
    }

    // burn opened crates
    nftGame.burn(msg.sender, crateId, amount);

    emit CratesOpened(crateId, amount);
  }

  function lockFinalScore() external {
    // trading-phase only
    uint256 phase = nftGame.getPhase();
    require(phase >= 2, "wrong game phase!");
    uint256 boostNumber = computeBoost(msg.sender);
    uint256 lockedNFTId = nftGame.userLock(msg.sender, boostNumber);

    // Emit locking event
    LockedScore(msg.sender, lockedNFTId);
  }

  /// Read-only functions

  /**
   * @notice Returns the totalBoost of user according to cards in possesion.
   * @dev Value is 100 based. In example; 150 is +50% or 1.5 in decimal
   */
  function computeBoost(address user) public view returns(uint256 totalBoost) {
    for (uint256 index = NFT_CARD_ID_START; index <=  NFT_CARD_ID_END; index++) {
      if (nftGame.balanceOf(user, index) > 0) {
        totalBoost += cardBoost[index];
      } 
    }
  }

  /// Internal functions

  /**
   * @notice calls redstone-oracle for entropy value.
   */
  function _getEntropy() private view returns (uint256) {
    return _getPriceFromMsg(bytes32("ENTROPY"));
  }
}
