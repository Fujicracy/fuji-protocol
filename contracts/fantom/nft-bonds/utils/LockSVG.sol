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

function initialize(address _nftGame) public initializer {   
    __UUPSUpgradeable_init();

    nftGame = NFTGame(_nftGame);
    _nftgame_GAME_ADMIN = nftGame.GAME_ADMIN();
  }

  function setNickname(uint256 tokenId_, string calldata _shortNickname) external {
    require(msg.sender == nftGame.ownerOfLockNFT(tokenId_), "Not owner!");
    require(_getStringByteSize(_shortNickname) <= 16, "Too long!");
    nicknames[msg.sender] = _shortNickname;
    emit ChangedNickname(msg.sender, _shortNickname);
  }

  function generateSVG(uint256 tokenId_) external override view returns (string memory) {
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
            '</svg>'
          )
        );
  }

  /// Internal functions

  function _generateStaticBackground() internal pure returns(string memory) {
    return
      string(
        abi.encodePacked(
          '<circle cx="300" cy="300" r="300" fill="none" stroke="black"/>'
        )
      );
  }

  function _generateAddressArch(uint256 tokenId_) internal view returns(string memory) {
    return
      string(
        abi.encodePacked(
          '<text textLength="100%" font-family="Lucida Console, Courier New, monospace" font-size="18" rotate="0" fill="#000">',
            '<textPath xlink:href="#a" startOffset="15%">',
            _getOwnerAddress(tokenId_),
            '</textPath>',
          '</text>'
        )
      );
  }

  function _generateFujiLogo() internal pure returns (string memory) {
    return
      string(
        abi.encodePacked(
          '<g transform="translate(460, 230) scale(.15 .15)">',
            '<circle cx="300" cy="300" r="235" fill="#101010" stroke="url(#paint0_linear_113_36)" stroke-width="130"/>',
            '<path d="M150 450.079L243.51 356.569C274.752 325.327 325.406 325.327 356.647 356.569L450 449.921L299.921 600L150 450.079Z" fill="#F5F5FD"/>',
            '<path d="M133.66 466C176.2 508.627 235.02 535 300 535C364.98 535 423.8 508.627 466.34 466" stroke="#E4E4EB" stroke-width="132"/>',
            '<defs>',
              '<linearGradient id="paint0_linear_113_36" x1="300" y1="-85.5" x2="300" y2="657.5" gradientUnits="userSpaceOnUse">',
                '<stop offset="0.178688" stop-color="#F60655"/>',
                '<stop offset="0.882382" stop-color="#101010"/>',
              '</linearGradient>',
            '</defs>',
          '</g>'
        )
      );
  }

  function _generateFTMLogo() internal pure returns(string memory) {
    return
      string(
        abi.encodePacked(
          '<g transform="translate(50, 230) scale(.15 .15)">',
          '<circle cx="300" cy="300" r="300" fill="#13B5EC"/>',
          '<path d="M194.688 181.856V418.513C194.688 420.43 195.784 422.178 197.51 423.014L302.607 473.867C304.075 474.577 305.797 474.527 307.221 473.733L405.543 418.886C407.145 417.992 408.129 416.294 408.107 414.46L405.35 181.684C405.328 179.876 404.332 178.22 402.745 177.354L307.235 125.247C305.802 124.466 304.078 124.432 302.617 125.158L197.464 177.377C195.763 178.222 194.688 179.957 194.688 181.856Z" stroke="white" stroke-width="16"/>',
          '<path d="M194.688 184.372L299.695 240.635C301.206 241.445 303.026 241.424 304.518 240.58L403.902 184.372" stroke="white" stroke-width="16"/>',
          '<path d="M301.164 241.045L197.938 296.354C196.539 297.104 196.529 299.106 197.92 299.87L299.683 355.725C301.2 356.558 303.038 356.547 304.545 355.698L403.601 299.859C404.966 299.089 404.956 297.12 403.583 296.365L303.073 241.055C302.48 240.729 301.761 240.725 301.164 241.045Z" stroke="white" stroke-width="16"/>',
          '<path d="M302.123 239.128V354.256" stroke="white" stroke-width="16"/>'
          '</g>'
        )
      );
  }

  function _generateClimberName(uint256 tokenId_) internal view returns(string memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId_);
    string memory name = nicknames[ownedBy];
    if (_getStringByteSize(name) > 0) {
      return
        string(
          abi.encodePacked(
            '<g transform="translate(180, 520)">',
            '<rect x="0" y="0" width="235" height="40" rx="5" fill="#D9D9D9" fill-opacity="0.5" stroke="#F22267" />',
            '<rect x="60" y="5" width="170" height="30" rx="5" fill="#988C8C" fill-opacity="0.25" stroke="#F22267" />',
            '<text x="6" y="25" font-family="Lucida Console, Courier New, monospace" font-size="12" font-weight="normal" fill="#000">Climber</text>',
            '<text x="70" y="25" font-family="Lucida Console, Courier New, monospace" font-size="16" font-weight="normal" fill="#000">', name, '</text>',
            '</g>'
          )
        );
    } else {
      return "";
    }
  }

  function _generateAltitudePoints(uint256 tokenId_) internal view returns(string memory) {
    return
      string(
        abi.encodePacked(
          '<g transform="translate(400, 330)">',
            '<rect x="0" y="0" width="185" height="40" rx="5" fill="#D9D9D9" fill-opacity="0.5" stroke="#F22267"/>',
            '<rect x="60" y="5" width="120" height="30" rx="5" fill="#988C8C" fill-opacity="0.25" stroke="#F22267"/>',
            '<text x="10" y="18" font-family="Lucida Console, Courier New, monospace" font-size="12" font-weight="normal" fill="#000">Meter</text>',
            '<text x="10" y="32" font-family="Lucida Console, Courier New, monospace" font-size="12" font-weight="normal" fill="#000">Points</text>',
            '<text x="65" y="30" font-family="Lucida Console, Courier New, monospace" font-size="22" font-weight="normal" fill="#000">', _getAltitudePoints(tokenId_),'</text>',
            '<text x="160" y="30" font-family="Lucida Console, Courier New, monospace" font-size="14" font-weight="normal" fill="#000">km</text>',
          '</g>'
        )
      );
  }

  function _generateDefs() internal pure returns(string memory) {
    return
      string(
        abi.encodePacked(
          '<defs>',
          '<path id="a" d="M30 300 A100 100 0 0 1 570 300" stroke="#000" stroke-width=".5" />',
          '</defs>'
        )
      );
  }

  function _getOwnerAddress(uint256 tokenId) internal view returns(string memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId);
    return ownedBy.addressToString();
  }

  function _getAltitudePoints(uint256 tokenId) internal view returns(bytes memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId);
    uint8 decimals = uint8(nftGame.POINTS_DECIMALS());
    uint8 kilometerUnits = decimals + 3;
    ( , , , ,uint128 finalScore, , ) = nftGame.userdata(ownedBy);
    return uint256(finalScore).uint2decimal(kilometerUnits).trim(kilometerUnits - 1);
  }

  function _hasNickname(address user) internal view returns(bool named) {
        string memory name = nicknames[user];
        if (bytes(name).length != 0) {
            named = true;
        }
    }

  function _getStringByteSize(string memory _string) internal pure returns (uint256) {
        return bytes(_string).length;
  }

  function _reverseString(string calldata _base) internal pure returns(string memory){
    bytes memory _baseBytes = bytes(_base);
    assert(_baseBytes.length > 0);
    string memory _tempValue = new string(_baseBytes.length);
    bytes memory _newValue = bytes(_tempValue);
    for(uint i=0;i<_baseBytes.length;i++){
        _newValue[ _baseBytes.length - i - 1] = _baseBytes[i];
    }
    return string(_newValue);
  }

  function _authorizeUpgrade(address newImplementation) internal view override {
    newImplementation;
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
  }
}