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

  uint256 private constant POINTS_ID = 0;
  uint256 public constant CRATE_COMMON_ID = 1;
  uint256 public constant CRATE_EPIC_ID = 2;
  uint256 public constant CRATE_LEGENDARY_ID = 3;
  uint256 public constant POINTS_DECIMALS = 5;

  uint256 public constant NFT_CARD_ID = 4;

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
  }

  /**
  * @notice Burns user points to mint a new crate
  */
  function getCrates(uint256 crateId, uint256 amount) external {
    require(crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID, "Invalid crate ID");

    uint price = cratePrices[crateId] * amount;
    require(price > 0, "Price not set");
    require(nftGame.balanceOf(msg.sender, POINTS_ID) >= price, "Not enough points");

    nftGame.burn(msg.sender, POINTS_ID, price);

    nftGame.mint(msg.sender, crateId, amount);
  }

  /**
  * @notice opens one crate with the given id
  */
  function openCrate(uint256 crateId, uint256 amount) external {
    require(crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID, "Invalid crate ID");
    require(nftGame.balanceOf(msg.sender, crateId) > 0, "Not enough crates");
    require(crateRewards[crateId].length == probabilityIntervals.length, "Rewards not set");

    uint256 pointsAmount = 0;
    uint256 cardsAmount = 0;

    uint256 randomNumber;
    bool isCard;
    for (uint256 index = 0; index < amount; index++) {
      randomNumber = LibPseudoRandom.pickRandomNumbers(1)[0];
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
      nftGame.mint(msg.sender, POINTS_ID, pointsAmount);
    }

    if (cardsAmount > 0) {
      nftGame.mint(msg.sender, NFT_CARD_ID, cardsAmount);
    }

    nftGame.burn(msg.sender, crateId, amount);
  }
}
