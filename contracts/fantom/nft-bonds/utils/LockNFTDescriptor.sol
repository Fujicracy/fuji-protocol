// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../NFTGame.sol";
import "../interfaces/ILockNFTDescriptor.sol";
import "../libraries/Base64.sol";

interface ILockNFTSVG {
  function generateSVG(uint256 tokenId_) external view returns (string memory);
}

contract LockNFTDescriptor is ILockNFTDescriptor {

  // VoucherSVG
  ILockNFTSVG public lockfNFTSVG;

  NFTGame private nftGame;

  bytes32 private _nftgame_GAME_ADMIN;

  constructor(
    address _nftGame,
    address _lockNFTSVG
  ) {
    nftGame = NFTGame(_nftGame);
    _nftgame_GAME_ADMIN = nftGame.GAME_ADMIN();
    lockfNFTSVG = ILockNFTSVG(_lockNFTSVG);
  }

  /// Admin functions

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
   * @notice Admin restricted function to set address for VoucherSVG contract
   */
  function setLockfNFTSVG(address _lockNFTSVG) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    lockfNFTSVG = ILockNFTSVG(_lockNFTSVG);
    emit SetLockNFTSVG(_lockNFTSVG);
  }

  /// View functions

  function lockNFTUri(uint256 tokenId) external override view returns (string memory) {
    string memory image = lockfNFTSVG.generateSVG(tokenId);
    return string(
      abi.encodePacked(
        "data:application/json;base64,",
        Base64.encode(
          abi.encodePacked(
            '{"name":"', "name",
            '","description":"', "description",
            '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(image)),
            '","properties":', _propertiesToken(),
            "}"
          )
        )
      )
    );
  }

  function _propertiesToken() internal pure returns (bytes memory data) {
    return abi.encodePacked(
        "{",
          '"user":', '"address of the user"',
          '"climbed meters":', '"total locked points"',
          '"captured gear":', '"gears"',
        "}"
     );
  }

}