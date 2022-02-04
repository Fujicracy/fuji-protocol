// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @title NFT Interactions
/// @author fuji-dao.eth

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import "../../abstracts/claimable/Claimable.sol";
import "./NFTGame.sol";
import "../libraries/LibPseudoRandom.sol";

contract NFTInteractions is Claimable {
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
  uint256 public constant NFT_CARD_ID_START = 4;
  uint256 public constant NFT_CARD_ID_END = 11;

  // CrateID => crate rewards
  mapping(uint256 => uint256[]) crateRewards;
  uint256[] private probabilityIntervals = [500000, 700000, 900000, 950000, 9501000];

  NFTGame private nftGame;

  // CrateID => crate price
  mapping(uint256 => uint256) public cratePrices;

  /**
  * @notice Set address for NFTGame contract
  */
  function setNFTGame(address _nftGame) external onlyOwner {
    nftGame = NFTGame(_nftGame);
  }

  /**
  * @notice sets the prices for the crates
  */
  function setCratePrice(uint256 crateId, uint256 price) external onlyOwner {
    require(crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID, "Invalid crate ID");
    cratePrices[crateId] = price;
    emit CratePriceChanged(crateId, price);
  }

  /**
  * @notice sets probability intervals for crate rewards
  */
  function setProbabilityIntervals(uint256[] memory intervals) external onlyOwner {
    probabilityIntervals = intervals;
  }

  /**
  * @notice sets crate rewards
  * rewards are an array, with each element corresponding to the points multiplier value
  */
  function setCrateRewards(uint256 crateId, uint256[] memory rewards) external onlyOwner {
    crateRewards[crateId] = rewards;
    emit CrateRewardsChanged(crateId, rewards);
  }

  /**
  * @notice Burns user points to mint a new crate
  */
  function getCrates(uint256 crateId, uint256 amount) external {
    require(crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID, "Invalid crate ID");

    uint price = cratePrices[crateId] * amount;
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
    require(crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID, "Invalid crate ID");
    require(nftGame.balanceOf(msg.sender, crateId) >= amount, "Not enough crates");
    require(crateRewards[crateId].length == probabilityIntervals.length, "Rewards not set");

    uint256 pointsAmount = 0;
    uint256[NFT_CARD_ID_END - NFT_CARD_ID_START + 1] memory cardsAmount;

    uint256[] memory randomNumbers = LibPseudoRandom.pickRandomNumbers(amount);
    bool isCard;

    // iterate all crates to open
    for (uint256 j = 0; j < amount; j++) {
      isCard = true;
      // iterate propability intervals to see the reward for a specific crate
      for (uint256 i = 0; i < probabilityIntervals.length && isCard; i++) {
        if (randomNumbers[j] < probabilityIntervals[i]) {
          isCard = false;
          pointsAmount += crateRewards[crateId][i];
        }
      }

      // if the reward is a card determine the card id
      if (isCard) {
        uint256 step = 1000000 / NFT_CARD_ID_END - NFT_CARD_ID_START + 1;
        uint256 randomNum = LibPseudoRandom.pickRandomNumbers(1)[0];
        uint256 randomId = NFT_CARD_ID_START;
        for (uint256 i = step; i <= 1000000; i += step) {
          if (randomNum <= i) {
            break;
          }
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
}
