// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../fantom/nft-bonds/NFTGame.sol";

contract PointFaucet is Ownable {

  /**
  * @dev Log a change in fuji admin address
  */
  event NFTGameChanged(address newNFTGame);

  address public nftGame;

  function getPointsFromFaucet(address user, uint points) external {
    NFTGame game = NFTGame(nftGame);
    game.mint(user, 0, points);
  }

  /**
   * @dev Sets the NFT Bond Logic address
   * @param _nftgame: new NFT Game address
   */
  function setNFTGame(address _nftgame) external onlyOwner {
    require(_nftgame != address(0), "Zero address!");
    nftGame = _nftgame;
    emit NFTGameChanged(_nftgame);
  }
  
}