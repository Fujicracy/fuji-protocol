// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../NFTGame.sol";
import "../interfaces/ILockSVG.sol";
import "../libraries/StringConvertor.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract LockSVG is ILockSVG, Initializable, UUPSUpgradeable {
  using StringConvertor for address;
  using StringConvertor for uint256;
  using StringConvertor for bytes;

  /**
   * @dev Changing valid vaults
   */
  event ChangedNickname(address indexed user, string _newnickname);

  NFTGame public nftGame;

  bytes32 private _nftgame_GAME_ADMIN;

  mapping(address => string) public nicknames;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {}

  function initialize(address _nftGame) public initializer {
    __UUPSUpgradeable_init();

    nftGame = NFTGame(_nftGame);
    _nftgame_GAME_ADMIN = nftGame.GAME_ADMIN();
  }

  /**
   * @notice Allows onwer of tokenId to set a visual nickname in LockNFT.
   * @dev Nickname string is restricted to 16 characters.
   */
  function setNickname(uint256 tokenId_, string calldata _shortNickname) external {
    require(msg.sender == nftGame.ownerOfLockNFT(tokenId_), "Not owner!");
    require(_getStringByteSize(_shortNickname) <= 16, "Too long!");
    nicknames[msg.sender] = _shortNickname;
    emit ChangedNickname(msg.sender, _shortNickname);
  }

  function generateSVG(uint256 tokenId_) external view override returns (string memory) {
    return
      string(
        abi.encodePacked(
          '<svg width="600" height="600" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
          _generateDefs(),
          _generateStaticBackground(),
          _generateAddressArch(tokenId_),
          _generateFujiLogo(),
          _generateFTMLogo(),
          _generateClimberName(tokenId_),
          _generateAltitudePoints(tokenId_),
          '<circle cx="300" cy="300" r="299" fill="none" stroke="#580C24" stroke-width="10"/>',
          "</svg>"
        )
      );
  }

  /// Internal functions

  function _generateStaticBackground() internal pure returns (string memory) {
    return
      string(
        abi.encodePacked(
          '<path d="M600 0H0V600H600V0Z" fill="url(#g1)"/>',
          '<path opacity="0.26" d="M251 284V600H0V327L70 298L100 255L148 245L165 251L251 284Z" fill="url(#g2)"/>',
          '<path opacity="0.26" d="M600 279V600H388L357 290L402 266L467 234L545 291L600 279Z" fill="url(#g2)"/>',
          '<path opacity="0.38" d="M599 279V300H572L566 313L546 342L555 311L542 296L483 276L486 300L457 272V260L408 284L402 267L467 234L545 291L599 279Z" fill="url(#g3)"/>',
          '<path opacity="0.38" d="M165 251C144 254 102 260 102 261C101 261 90 300 90 300L73 305L0 347.5V327L70 298L100 255L148 245L166 252Z" fill="url(#g4)"/>',
          '<path d="M193 187C193 129 240 82 297 82C355 81 402 128 402 186C403 215 391 242 371 261C352 280 327 291 299 291C270 291 244 280 225 261C206 243 194 216 193 187V187Z" fill="#101010" stroke="url(#g5)" stroke-width="59"/>',
          '<path d="M600 378V600H0V378C43 362 119 325 188 258C216 231 240 201 260 169L264 162C264 162 269 157 278 158L287 154L291 153L306 156L319 154L334 160C334 160 354 211 419 269C460 306 518 345 600 378Z" fill="url(#g6)"/>',
          '<path d="M343 224C338 254 317 269 317 269C296 265 287 225 287 225C283 262 257 269 257 269C245 260 239 237 239 237C222 259 190 258 188 258C216 231 240 201 260 169L264 162C264 162 269 157 278 158L287 154L291 153L306 156L319 154L334 160C334 160 354 211 419 269C340 262 343 224 343 224Z" fill="url(#g7)"/>',
          '<path opacity="0.58" d="M267 161C267 161 268 165 280 165H304L321 166C321 166 331 164 333 162V161L319 156L306 157L291 155L279 159C279 159 271 159 267 161Z" fill="url(#g8)"/>',
          _generateClouds(),
          _generateAlpineClimber()
        )
      );
  }

  function _generateClouds() internal pure returns (string memory) {
    return
      string(
        abi.encodePacked(
          '<path d="M183 186c-4 2-6 1-5-2h-3c-1 0-2 0-2 1-1 0-2 1-2 1-1 1-1 2-1 3-1 3 2 6 5 8h5c2 0 4-1 5-1 3-2 6-5 8-7 2 1 5 1 7 1 3 0 5-1 ',
          "7-3s3-4 4-6c0-3 0-5-1-7-1-3-3-4-5-6-3-1-5-1-8-1v3c1-3 1-6 1-9-1-3-3-6-5-8-3-2-6-3-9-3s-7 0-9 2c-3 1-5 3-7 6-1 3-2 6-1 10-3-4-5-8-9-10-3-2-8-3-11-1-4 ",
          "2-6 6-6 11 0 2 0 5 1 7 2 2 5 4 7 3 3-1 3-5 1-7 3 1 4 5 2 7s-5 2-7 2c-3-1-6 0-8-3-2-2-5-3-7-3-4 0-8 1-11 3s-6 5-10 6c-3 1-7 1-9-2 0 4 6 6 10 5 5 0 9-2 ",
          "14-2 9 0 15 7 23 9 3 1 6 1 9 0 3 0 6-2 9-3 2-2 3-5 5-6 3-2 5-4 8-4 3 1 6 3 5 6Z",
          "m213-58c4 2 6 1 6-2h2c1 0 2 1 2 1 1 0 2 1 2 2 1 1 1 1 1 2 1 3-2 6-5 8h-5c-1 0-3-1-5-1-2-2-5-4-7-7-2 1-4 1-7 1-2 0-5-1-7-3-1-1-3-3-3-6-1-2 ",
          "0-4 1-7 1-2 3-3 5-5 2-1 5-1 7-1v3c-1-3-1-6 0-9 0-3 2-5 4-7 3-2 6-3 9-3 3-1 6 0 9 1 2 2 5 4 6 6 1 3 2 6 2 9 2-3 4-6 7-9 4-2 8-3 11-1 4 2 6 6 6 11 0 2 0 5-1 ",
          "7-2 2-5 3-7 2s-3-5-1-6c-2 1-3 4-1 6 1 2 4 3 7 3 2-1 5-2 6-4 3-1 6-2 8-2 4-1 7 1 10 3s6 4 9 5c4 1 8 1 10-1-1 4-6 5-10 5-5-1-9-3-14-3-8 0-14 7-22 9-3 1-6 1-9 ",
          '0s-5-1-8-4c-2-1-3-3-5-5s-5-3-8-3c-2 0-5 2-5 5Z" fill="#fff"/>'
        )
      );
  }

  function _generateAlpineClimber() internal pure returns (string memory) {
    return
      string(
        abi.encodePacked(
          '<g transform="translate(140 180)"><path d="m28 216-2 21-6 55L7 416H0l13-124 6-53 3-24Z" fill="url(#a1)" /><path d="M334 416h-7l-15-126-2-18-1-11-6-48-3-28 7-1 3 23 6 53 2 15 2 18 14 124Z" fill="url(#a2)" /><path d="M98 159s-33 15-32 64v31s-5 10 6 14l2 2-9 2s-12 7-5 26l29 5 6-4 14-126s-2-13-11-14Z" fill="url(#a3)" /><path d="M341 237v8l-13 8-6 7h-11a18 18 0 0 1-2 2 17 17 0 0 1-10 3l-4 3-6 4-9-2s-4-5-4-8l-6-1-16-3-1-9-7-1-1-9-23-33 2.12 35s4 18 3 23l-2 20 6 31a9 9 0 0 1-4 5l9 97h-68l-6-43s-6 22-12 43h-68l11-107s-1-7.8.7-10v-19l4-20s8-52 8-55l-6-7s-16 41-22 45l-8 9-5 4-5 11s-5 6-9 6l-4-1-13 16-9 3-4.19.3-6.6.4h-.5s-11 0-9-11c0 0-2-4 0-8 0 0-2-6 2-11v-8l12-8-1-5 2-2 1-1 7-2 2-.5s26-50 30-57a77 77 0 0 0 5-12s-1-11 3-15 16-29 16-29 8-9 11-10c4-1 21-8 21-8s13-6 14-7c1-1.4.7-9.9.7-10V88l-.2-.2c-2-2-10-13-6-24a34 34 0 0 1-6-22l-5-4s-4-14 6-14c0 0 4-22 24-23h25l9-1 12 4s6 11 8 12c3 1 7 8 7 8s0 5-1 7 7 6-1 15c0 0-2 16-11 28l7 9.2.5.7s-.2.4-.4 1a34 34 0 0 0-1 17l35 18 18 21 4 15c-1 0 18 25 25 52l4 2.1.7 4 8 6 10.6.7 3-6 1-1 6-6 6-6s9 1 9 3a45 45 0 0 1-1 5l6-1a5 5 0 0 1 4 5 11 11 0 0 1 5 9s5 5 3 14l1.4.7Z" fill="#1C0D12" /><path d="M112 42s14-20 52-6l1 2 2.8.7s.2.6.5 2c1 3 2 11 0 18a59 59 0 0 1-24 6s-6-3-9-8c0 0-5-6-9 4l-1 4a9 9 0 0 1-6 1l-4-6s-4-11-2-18Z" fill="url(#a4)" /><path d="M199 46s-8-7-31-6c0 0 2 8 1 10 0 0 2.2.7 28 4 0 0 2-3 2-8Z" fill="url(#a5)" /><path d="m112 173-13 23s4 6 7 7c0 0 12-20 14-27 0 0-6-5-8-4Z" fill="#AD053B" /><path d="M112 105a15 15 0 0 1 14-6s13 8 15 32c0 0-11 35-21 47l-9-4s22-51 1-69Z" fill="url(#a6)" /><path d="M208 107c5 8 11 33 11 33 0 1-1 50-1 50-2-11-25-75-25-75a16 16 0 0 1 2-16s8 2 13 7Z" fill="url(#a7)" /><path d="M168 94h-2s4 18 3 45c0 0-3 28 0 43l6 45 1 8-5 45s-6 22-4 28c0 0-4-3 0-24l5-47-4-33s-6-41-3-52c0 0 2-45-1-57v-1s-14 3-38-7c-.4-.2-.8-.3-1-.5l1 .3c5 2 28 9 36 6 0 0 25-4 31-11l.5.7s-.2.4-.4 1c-3 2-11 8-26 10Z" fill="url(#a8)" /><path d="M100 235s111-18 126 8c0 0 4 5 1 13 0 0-14-31-129-5" fill="url(#a9)" /><defs><linearGradient id="a1" x1="23" y1="214" x2="-5" y2="523" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" /><stop offset=".1" stop-color="#FEF8FA" /><stop offset=".2" stop-color="#FCE6ED" /><stop offset=".4" stop-color="#F9C7D8" /><stop offset=".5" stop-color="#F59DBA" /><stop offset=".7" stop-color="#EF6693" /><stop offset=".9" stop-color="#E92565" /><stop offset="1" stop-color="#E5024C" /></linearGradient><linearGradient id="a2" x1="312.249" y1="266.94" x2="342.679" y2="485.42" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" /><stop offset=".1" stop-color="#FEF8FA" /><stop offset=".2" stop-color="#FCE6ED" /><stop offset=".4" stop-color="#F9C7D8" /><stop offset=".5" stop-color="#F59DBA" /><stop offset=".7" stop-color="#EF6693" /><stop offset=".9" stop-color="#E92565" /><stop offset="1" stop-color="#E5024C" /></linearGradient><linearGradient id="a3" x1="62.101" y1="227.54" x2="112.991" y2="233.13" gradientUnits="userSpaceOnUse"><stop stop-color="#EA014E" /><stop offset="1" stop-color="#580C24" /></linearGradient><linearGradient id="a4" x1="111.81" y1="48.48" x2="169.81" y2="48.48" gradientUnits="userSpaceOnUse"><stop stop-color="#EA014E" /><stop offset="1" stop-color="#580C24" /></linearGradient><linearGradient id="a5" x1="186.45" y1="37.74" x2="176.12" y2="63.75" gradientUnits="userSpaceOnUse"><stop stop-color="#EA014E" /><stop offset=".86" stop-color="#580C24" /></linearGradient><linearGradient id="a6" x1="125.93" y1="106.54" x2="125.93" y2="178.97" gradientUnits="userSpaceOnUse"><stop stop-color="#EA014E" /><stop offset="1" stop-color="#580C24" /></linearGradient><linearGradient id="a7" x1="203.109" y1="115.17" x2="218.629" y2="179.68" gradientUnits="userSpaceOnUse"><stop stop-color="#EA014E" /><stop offset="1" stop-color="#580C24" /></linearGradient><linearGradient id="a8" x1="97.449" y1="242.1" x2="228.799" y2="242.1" gradientUnits="userSpaceOnUse"><stop stop-color="#EA014E" /><stop offset="1" stop-color="#580C24" /></linearGradient></defs></g>'
        )
      );
  }

  function _generateAddressArch(uint256 tokenId_) internal view returns (string memory) {
    return
      string(
        abi.encodePacked(
          '<text textLength="100%" font-family="Lucida Console, Courier New, monospace" font-size="20" rotate="0" fill="white">',
          '<textPath xlink:href="#a" startOffset="15%">',
          _getOwnerAddress(tokenId_),
          "</textPath>",
          "</text>"
        )
      );
  }

  function _generateFujiLogo() internal pure returns (string memory) {
    return
      string(
        abi.encodePacked(
          '<g transform="translate(480, 190) scale(.15 .15)">',
          '<circle cx="300" cy="300" r="235" fill="#101010" stroke="url(#f1)" stroke-width="130"/>',
          '<path d="M150 450.079L243.51 356.569C274.752 325.327 325.406 325.327 356.647 356.569L450 449.921L299.921 600L150 450.079Z" fill="#F5F5FD"/>',
          '<path d="M133.66 466C176.2 508.627 235.02 535 300 535C364.98 535 423.8 508.627 466.34 466" stroke="#E4E4EB" stroke-width="132"/>',
          "<defs>",
          '<linearGradient id="f1" x1="300" y1="-85.5" x2="300" y2="658" gradientUnits="userSpaceOnUse">',
          '<stop offset="0.18" stop-color="#F60655"/>',
          '<stop offset="0.88" stop-color="#101010"/>',
          "</linearGradient>",
          "</defs>",
          "</g>"
        )
      );
  }

  function _generateFTMLogo() internal pure returns (string memory) {
    return
      string(
        abi.encodePacked(
          '<g transform="translate(30, 190) scale(.15 .15)">',
          '<circle cx="300" cy="300" r="300" fill="#13B5EC"/>',
          '<path d="M194.688 181.856V418.513C194.688 420.43 195.784 422.178 197.51 423.014L302.607 473.867C304.075 474.577 305.797 474.527 307.221 473.733L405.543 418.886C407.145 417.992 408.129 416.294 408.107 414.46L405.35 181.684C405.328 179.876 404.332 178.22 402.745 177.354L307.235 125.247C305.802 124.466 304.078 124.432 302.617 125.158L197.464 177.377C195.763 178.222 194.688 179.957 194.688 181.856Z" stroke="white" stroke-width="16"/>',
          '<path d="M194.688 184.372L299.695 240.635C301.206 241.445 303.026 241.424 304.518 240.58L403.902 184.372" stroke="white" stroke-width="16"/>',
          '<path d="M301.164 241.045L197.938 296.354C196.539 297.104 196.529 299.106 197.92 299.87L299.683 355.725C301.2 356.558 303.038 356.547 304.545 355.698L403.601 299.859C404.966 299.089 404.956 297.12 403.583 296.365L303.073 241.055C302.48 240.729 301.761 240.725 301.164 241.045Z" stroke="white" stroke-width="16"/>',
          '<path d="M302.123 239.128V354.256" stroke="white" stroke-width="16"/>'
          "</g>"
        )
      );
  }

  function _generateClimberName(uint256 tokenId_) internal view returns (string memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId_);
    string memory name = nicknames[ownedBy];
    uint256 xloc = 110 - 5 * _getStringByteSize(name);
    if (_getStringByteSize(name) > 0) {
      return
        string(
          abi.encodePacked(
            '<g transform="translate(200, 490)" font-family="Lucida Console, Courier New, monospace" fill="white" font-weight="normal">',
            '<rect x="0" y="0" width="220" height="60" rx="5" fill="#D9D9D9" fill-opacity="0.2" stroke="#F22267"/>',
            '<rect x="25" y="22" width="170" height="30" rx="5" fill="#988C8C" fill-opacity="0.1" stroke="#F22267"/>',
            '<text x="85" y="15" font-size="12">Climber</text>',
            '<text x="', xloc.toString(), '" y="42" font-size="18">', name, "</text>",
            "</g>"
          )
        );
    } else {
      return "";
    }
  }

  function _generateAltitudePoints(uint256 tokenId_) internal view returns (string memory) {
    bytes memory altitude = _getAltitudePoints(tokenId_);
    uint256 xloc = 137 - 10 * altitude.length;
    return
      string(
        abi.encodePacked(
          '<g transform="translate(400, 330)" font-family="Lucida Console, Courier New, monospace" font-size="12" font-weight="normal" fill="white">',
          '<rect x="0" y="0" width="185" height="40" rx="5" fill="#D9D9D9" fill-opacity="0.5" stroke="#F22267"/>',
          '<rect x="60" y="5" width="120" height="30" rx="5" fill="#988C8C" fill-opacity="0.25" stroke="#F22267"/>',
          '<text x="10" y="18">Meter</text>',
          '<text x="10" y="32">Points</text>',
          '<text x="', xloc.toString(), '" y="30" font-size="22">', altitude, "</text>",
          '<text x="160" y="30" font-size="14">km</text>',
          "</g>"
        )
      );
  }

  function _generateDefs() internal pure returns (string memory) {
    return
      string(
        abi.encodePacked(
          "<defs>",
          '<path id="a" d="M30 300 A100 100 0 0 1 570 300" stroke="#000" stroke-width=".5"/>',
          '<linearGradient id="g1" x1="299" y1="2.5" x2="300" y2="600" gradientUnits="userSpaceOnUse"><stop stop-color="#170D10"/><stop offset="1" stop-color="#500C22"/></linearGradient>',
          '<linearGradient id="g2" x1="357" y1="416" x2="600" y2="416" gradientUnits="userSpaceOnUse"><stop stop-color="#EA014E"/><stop offset="1" stop-color="#580C24"/></linearGradient>',
          '<linearGradient id="g3" x1="403" y1="288" x2="600" y2="288" gradientUnits="userSpaceOnUse"><stop stop-color="#EA014E"/><stop offset="1" stop-color="#580C24"/></linearGradient>',
          '<linearGradient id="g4" x1="0" y1="296" x2="166" y2="296" gradientUnits="userSpaceOnUse"><stop stop-color="#EA014E"/><stop offset="1" stop-color="#580C24"/></linearGradient>',
          '<linearGradient id="g5" x1="298" y1="51" x2="298" y2="321" gradientUnits="userSpaceOnUse"><stop offset="0.1" stop-color="#F80656"/><stop offset="0.9" stop-color="#0E0E0E"/></linearGradient>',
          '<linearGradient id="g6" x1="300" y1="129" x2="300" y2="642" gradientUnits="userSpaceOnUse"><stop stop-color="#EA014E"/><stop offset="1" stop-color="#580C24"/></linearGradient>',
          '<linearGradient id="g7" x1="304" y1="224" x2="304" y2="25" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset=".1" stop-color="#FEF8FA"/><stop offset=".2" stop-color="#FCE6ED"/><stop offset=".4" stop-color="#F9C7D8"/><stop offset=".5" stop-color="#F59DBA"/><stop offset=".7" stop-color="#EF6693"/><stop offset=".9" stop-color="#E92565"/><stop offset="1" stop-color="#E5024C"/></linearGradient>',
          '<linearGradient id="g8" x1="300" y1="173" x2="300" y2="155" gradientUnits="userSpaceOnUse"><stop stop-color="#F0014F"/><stop offset="0.1" stop-color="#F00853"/><stop offset="0.3" stop-color="#EE1A60"/><stop offset="0.5" stop-color="#EC3974"/><stop offset="0.8" stop-color="#E96391"/><stop offset="1" stop-color="#E68EAE"/></linearGradient>'
          "</defs>"
        )
      );
  }

  function _getOwnerAddress(uint256 tokenId) internal view returns (string memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId);
    return ownedBy.addressToString();
  }

  function _getAltitudePoints(uint256 tokenId) internal view returns (bytes memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId);
    uint8 decimals = uint8(nftGame.POINTS_DECIMALS());
    uint8 kilometerUnits = decimals + 3;
    (, , , , uint128 finalScore, , ) = nftGame.userdata(ownedBy);
    return uint256(finalScore).uint2decimal(kilometerUnits).trim(kilometerUnits - 1);
  }

  function _hasNickname(address user) internal view returns (bool named) {
    string memory name = nicknames[user];
    if (bytes(name).length != 0) {
      named = true;
    }
  }

  function _getStringByteSize(string memory _string) internal pure returns (uint256) {
    return bytes(_string).length;
  }

  function _reverseString(string calldata _base) internal pure returns (string memory) {
    bytes memory _baseBytes = bytes(_base);
    assert(_baseBytes.length > 0);
    string memory _tempValue = new string(_baseBytes.length);
    bytes memory _newValue = bytes(_tempValue);
    for (uint256 i = 0; i < _baseBytes.length; i++) {
      _newValue[_baseBytes.length - i - 1] = _baseBytes[i];
    }
    return string(_newValue);
  }

  function _authorizeUpgrade(address newImplementation) internal view override {
    newImplementation;
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
  }
}
