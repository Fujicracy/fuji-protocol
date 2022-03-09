// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./utils/VoucherCore.sol";
import "./NFTGame.sol";

contract PreTokenBonds is VoucherCore {
  /**
   * @dev NFTGame contract address changed
   */
  event NFTGameChanged(address newAddress);

  NFTGame private nftGame;

  function _initialize(
      string memory _name,
      string memory _symbol,
      uint8 _unitDecimals,
      address _nftGame
  ) internal override {
    VoucherCore._initialize(_name, _symbol, _unitDecimals);
    nftGame = NFTGame(_nftGame);
  }

  /**
   * @notice Set address for NFTGame contract
   */
  function setNFTGame(address _nftGame) external {
    require(nftGame.hasRole(nftGame.GAME_ADMIN(), msg.sender), "No permission!");
    nftGame = NFTGame(_nftGame);
    emit NFTGameChanged(_nftGame);
  }

  /**
   * @notice Function to be called from Interactions contract, after burning the points
   */
  function mint() {
    require(nftGame.hasRole(nftGame.GAME_INTERACTOR(), msg.sender), "No permission!");
  }
}