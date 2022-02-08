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

  uint256 public constant CRATE_COMMON_ID = 1;
  uint256 public constant CRATE_EPIC_ID = 2;
  uint256 public constant CRATE_LEGENDARY_ID = 3;
  uint256 public constant NFT_CARD_ID = 4;

  // CrateID => crate rewards
  mapping(uint256 => uint256[]) crateRewards;
  uint256[] private probabilityIntervals;

  NFTGame private nftGame;

  // CrateID => crate price
  mapping(uint256 => uint256) public cratePrices;

  function initialize(address _nftGame) external initializer {
    maxDelay = 3 * 60;
    nftGame = NFTGame(_nftGame);
    probabilityIntervals = [500000, 700000, 900000, 950000, 9501000];
  }

  // Admin functions

  /**
  * @notice Set address for NFTGame contract
  */
  function setNFTGame(address _nftGame) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission");
    nftGame = NFTGame(_nftGame);
  }

  /**

  * @notice sets the prices for the crates
  */
  function setCratePrice(uint256 crateId, uint256 price) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission");
    require(crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID, "Invalid crate ID");
    cratePrices[crateId] = price;
    emit CratePriceChanged(crateId, price);
  }

  /**

  * @notice sets probability intervals for crate rewards
  */
  function setProbabilityIntervals(uint256[] memory intervals) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission");
    probabilityIntervals = intervals;
  }

  /**

  * @notice sets crate rewards
  * rewards are an array, with each element corresponding to the points multiplier value
  */
  function setCrateRewards(uint256 crateId, uint256[] memory rewards) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission");
    crateRewards[crateId] = rewards;
    emit CrateRewardsChanged(crateId, rewards);
  }

  /**
   * @notice sets allowed signer address of entropy feed.
   * Admin function required by redstone-evm-connector (oracle).
   */
  function authorizeSignerEntropyFeed(address _trustedSigner) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission");
    _authorizeSigner(_trustedSigner);
  }

  /**
   * @notice sets max allowed delay between front-end call and entropy feed.
   * Admin function required by redstone-evm-connector (oracle).
   */
  function setMaxEntropyDelay(uint256 _maxDelay) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission");
    _setMaxDelay(_maxDelay);
  }

  /// Interaction Functions

  /**
   * @notice Burns user points to mint a new crate
   */
  function getCrates(uint256 crateId, uint256 amount) external {
    require(
      crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID,
      "Invalid crate ID"
    );

    uint256 price = cratePrices[crateId] * amount;
    require(price > 0, "Price not set");
    require(nftGame.balanceOf(msg.sender, nftGame.POINTS_ID()) >= price, "Not enough points");

    nftGame.burn(msg.sender, nftGame.POINTS_ID(), price);

    nftGame.mint(msg.sender, crateId, amount);

    emit CratesAcquired(crateId, amount);
  }

  /**
   * @notice opens one crate with the given id
   */
  function openCrate(uint256 crateId, uint256 amount) external {
    require(
      crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID,
      "Invalid crate ID"
    );
    require(nftGame.balanceOf(msg.sender, crateId) >= amount, "Not enough crates");
    require(crateRewards[crateId].length == probabilityIntervals.length, "Rewards not set");

    uint256 pointsAmount = 0;
    uint256 cardsAmount = 0;

    uint256 randomNumber;
    uint256 entropyValue = _getEntropy();
    bool isCard;
    for (uint256 index = 0; index < amount; index++) {
      randomNumber = LibPseudoRandom.pickRandomNumbers(1, entropyValue)[0];
      isCard = true;
      for (uint256 i = 0; i < probabilityIntervals.length && isCard; i++) {
        if (randomNumber < probabilityIntervals[i]) {
          isCard = false;
          pointsAmount += crateRewards[crateId][i];
        }
      }

      if (isCard) {
        cardsAmount++;
      }
    }

    if (pointsAmount > 0) {
      nftGame.mint(msg.sender, nftGame.POINTS_ID(), pointsAmount);
    }

    if (cardsAmount > 0) {
      nftGame.mint(msg.sender, NFT_CARD_ID, cardsAmount);
    }

    nftGame.burn(msg.sender, crateId, amount);

    emit CratesOpened(crateId, amount);
  }

  /// Internal functions

  /**
   * @notice calls redstone-oracle for entropy value.
   */
  function _getEntropy() private view returns (uint256) {
    return _getPriceFromMsg(bytes32("ENTROPY"));
  }
}
