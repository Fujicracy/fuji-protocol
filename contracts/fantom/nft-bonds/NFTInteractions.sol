// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @title NFT Interactions
/// @author fuji-dao.eth

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import "../../abstracts/claimable/Claimable.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IVaultControl.sol";
import "../../interfaces/IERC20Extended.sol";
import "./NFTGame.sol";

contract NFTInteractions is Claimable {

  uint256 private constant POINTS_ID = 0;
  uint256 public constant CRATE_COMMON_ID = 1;
  uint256 public constant CRATE_EPIC_ID = 2;
  uint256 public constant CRATE_LEGENDARY_ID = 3;
  uint256 public constant POINTS_DECIMALS = 5;

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
  * @notice Burns user points to mint a new crate
  */
  function getCrates(uint256 crateId, uint256 amount) external {
    require(crateId == CRATE_COMMON_ID || crateId == CRATE_EPIC_ID || crateId == CRATE_LEGENDARY_ID, "Invalid crate ID");

    uint price = cratePrices[crateId] * amount;
    require(price > 0, "Price not set");

    require(nftGame.balanceOf(msg.sender, POINTS_ID) >= price, "Not enough points");

    nftGame.usePoints(msg.sender, price);

    nftGame.mint(msg.sender, crateId, amount);
  }
}
