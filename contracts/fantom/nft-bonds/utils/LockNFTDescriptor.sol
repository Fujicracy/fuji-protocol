// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../NFTGame.sol";
import "../interfaces/ILockNFTDescriptor.sol";
import "../interfaces/ILockSVG.sol";
import "../libraries/Base64.sol";
import "../libraries/StringConvertor.sol";

contract LockNFTDescriptor is ILockNFTDescriptor {
  using StringConvertor for address;
  using StringConvertor for uint256;
  using StringConvertor for bytes;

  // VoucherSVG
  ILockSVG public lockSVG;

  NFTGame public nftGame;

  bytes32 private _nftgame_GAME_ADMIN;

  constructor(
    address _nftGame,
    address _lockNFTSVG
  ) {
    nftGame = NFTGame(_nftGame);
    _nftgame_GAME_ADMIN = nftGame.GAME_ADMIN();
    lockSVG = ILockSVG(_lockNFTSVG);
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
    lockSVG = ILockSVG(_lockNFTSVG);
    emit SetLockNFTSVG(_lockNFTSVG);
  }

  /// View functions

  function lockNFTUri(uint256 tokenId) external override view returns (string memory) {
    string memory image = lockSVG.generateSVG(tokenId);
    return string(
      abi.encodePacked(
        "data:application/json;base64,",
        Base64.encode(
          abi.encodePacked(
            '{"name":"', "Proof Of Locking Ceremony",
            '","description":"', "Fuji Climb: Fantom Expedition - Souvenir NFT",
            '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(image)),
            '","properties":', _propertiesToken(tokenId),
            "}"
          )
        )
      )
    );
  }

  function _propertiesToken(uint256 tokenId) internal view returns (bytes memory data) {
    return abi.encodePacked(
        "{",
          '"owner":"', _getOwnerAddress(tokenId),'",',
          '"climbed meters":', _getAltitudePoints(tokenId),',',
          '"gear power":', _getGearPower(tokenId),
        "}"
     );
  }

  function _getOwnerAddress(uint256 tokenId) internal view returns(string memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId);
    return ownedBy.addressToString();
  }

  function _getAltitudePoints(uint256 tokenId) internal view returns(string memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId);
    uint8 decimals = uint8(nftGame.POINTS_DECIMALS());
    ( , , , ,uint128 finalScore, , ) = nftGame.userdata(ownedBy);
    uint256 number = uint256(finalScore) / 10 ** decimals;
    return number.toString();
  }

  function _getGearPower(uint256 tokenId) internal view returns(string memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId);
    ( , , , , , uint128 gearPower, ) = nftGame.userdata(ownedBy);
    return uint256(gearPower).toString();
  }
}