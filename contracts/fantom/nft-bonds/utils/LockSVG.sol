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
            '<svg width="600px" height="600px" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
            _generateStaticBackground(),
            _generateFujiLogo(),
            _generateFTMLogo(),
            _generateClimberName(tokenId_),
            _generateAltitudePoints(tokenId_),
            _generateDefs(),
            '</svg>'
          )
        );
  }

  /// Internal functions

  function _generateStaticBackground() internal pure returns(string memory) {
    return
      string(
        abi.encodePacked(
          '<path fill="#D9D9D9" d="M0 0h600v600H0z"/>',
          '<circle cx="300" cy="300" r="250" fill="#fff"/>',
          '<path d="M90.757 212.404H64.09l26.668-54.056 24.656-32.948 21.134-21.622 39.752-26.77 41.261-19.049 48.809-13.385L307.127 42l37.372 4.5 55 17 49 29 43.5 46 30 43.5H473l-54.001-17.5-55-33.5-45.432-35.948a20 20 0 0 0-23.554-.923L212.499 149.5l-86.5 49.5-35.242 13.404Z" fill="url(#a)"/>',
          '<path d="M90.5 213H66l-11.5 39.5-4 27v40l7.5 46 12.5 33L82 423l16.5 22 24-22 32.375-25.438L185 380l35.5-14.5L328 349l87.5-15 132-78-13.5-45.5-13-29h-48.5l-23-7L421 164l-8-3.5-54-32.5 62 44.5-71-42.5 32.5 37-42-35 13.5 32-26-36 9.5 64-17.5-60-4.5 20.5-8-10.5-2.5 45-7.5-47.5-16 36.5 8-44-32 53c5.333-15 26-55.8 26-57 0-1.2-3.167.167-16 19.5v-11l-33 25.5 20-24-34 22.5 21.5-21-57 35 31-27-59.5 34-34 20-32 11.5Z" fill="#37475E"/>',
          '<path d="M130.5 484 113 466l-9.5-11.5-8-11 19-18 27-23.5 45-30 30.5-11 20-5 39.5-2.5 43-6.5 37-7 26-6 38.5-4.5-20.5 24-26.5 25-26 26-11.5 16.5-14.5 29-17.5 39-14 28-15 31.5-28-3.5-22.5-6-26-10-25-12-25-16.5-18.5-16.5Z" fill="#88735D"/>',
          '<path d="m80.5 285.5-29 30 2 18 3 14.5 4 16.5 3.5 15 7.5 19 9 22 10 12.5 7.5 10.5 32-28.5 38-28 55-24.5 49.5-6.5 49-6 98.5-19.5-58-8-57-10-62.5-21L206 280l-33.5-15-37-10-29 10-26 20.5Z" fill="#555D72" stroke="#555D72" stroke-width="4"/>',
          '<path d="m334 408-62 140 46.5 3 45.5-6.5 52.5-24.5 45.5-28 27-28.5 23-31 19.5-34.5 13.5-46 5-32.5v-33l-3-31-30.5 16.5-105 61.5L334 408Z" fill="#302A28"/>',
          '<path d="m165.034 477.842-5.861 26.662a5 5 0 0 0 2.119 5.241l3.941 2.614 16.311 8.372 23.106 9.016 21.068 7.085 29.903 7.084 23.107 3.864L293 549.712l32.112 1.049c3.515.115 6.047-3.339 4.88-6.656l-.85-2.417a5.053 5.053 0 0 0-.295-.675l-9.342-17.706-8.576-13.127a5.044 5.044 0 0 1-.439-.836l-4.203-10.241a5.006 5.006 0 0 1-.374-1.899v-9.318l-.657-22.406a5.005 5.005 0 0 0-.281-1.513l-9.1-25.868a5.048 5.048 0 0 1-.227-.914l-1.834-12.163a5.013 5.013 0 0 1 .052-1.778l.875-4.147a5.014 5.014 0 0 1 1.299-2.444l5.766-5.96a5.017 5.017 0 0 0 1.074-1.685l2.021-5.267a5.01 5.01 0 0 0 .332-1.791v-4.718c0-.528.083-1.052.247-1.553l8.588-26.292 1.162-3.854c.131-.434.32-.848.563-1.231l1.34-2.117a5.03 5.03 0 0 1 .785-.955l6.661-6.312c.241-.228.459-.48.65-.752l4.963-7.054a3.71 3.71 0 0 0 .324-.559c1.179-2.513 4.598-2.887 6.293-.69l8.793 11.403c.271.351.586.664.939.932l2.313 1.753c.367.278.695.607.972.975l2.98 3.953 16.311 19.964 8.739 10.648a5 5 0 0 1 1.027 2.14l.991 4.693c.077.367.196.724.353 1.064l4.354 9.431c.111.24.241.472.388.692l13.849 20.622c.134.2.254.409.357.625l2.751 5.734a5.01 5.01 0 0 1 .491 2.162v1.591a5 5 0 0 0 5 5h4.573c.413 0 .824.051 1.225.153l13.56 3.426c3.159.798 6.225-1.589 6.225-4.847v-1.79c0-.947-.269-1.875-.776-2.675l-.487-.77a4.998 4.998 0 0 1-.776-2.675v-.656c0-.734-.161-1.459-.473-2.123l-2.09-4.457a4.865 4.865 0 0 1-.261-.68l-1.086-3.603a4.973 4.973 0 0 1-.203-1.134l-.607-9.771a5.024 5.024 0 0 0-.215-1.172l-3.22-10.375-2.497-8.872a5.001 5.001 0 0 0-.684-1.465l-7.013-10.272-9.09-11.689a4.975 4.975 0 0 1-.685-1.189l-2.796-6.887a4.992 4.992 0 0 0-.959-1.512l-8.583-9.295a5.046 5.046 0 0 1-.561-.733l-16.744-26.656-3.287-5.711a3.666 3.666 0 0 0-2.332-1.739 3.665 3.665 0 0 1-1.957-1.202l-4.352-5.155a5.08 5.08 0 0 1-.537-.773l-10.331-18.357a4.967 4.967 0 0 0-.749-1.009l-6.031-6.287a5.023 5.023 0 0 0-.712-.614l-12.683-9.014a5.005 5.005 0 0 0-1.125-.6l-18.931-7.176a4.992 4.992 0 0 0-1.772-.325h-2.497c-.441 0-.881-.058-1.307-.174l-3.684-.997a5.068 5.068 0 0 1-.835-.308l-4.316-2.045a3.522 3.522 0 0 0-1.51-.34 3.526 3.526 0 0 1-3.503-3.937l.104-.883a4.31 4.31 0 0 1 .64-1.806l1.513-2.39 4.137-5.04c.41-.5.719-1.073.91-1.69l3.108-10.015 1.663-6.827a4.996 4.996 0 0 0-.209-3.023l-3.142-7.94a5.012 5.012 0 0 1-.35-1.839v-20.734c0-.565-.096-1.126-.284-1.659l-2.205-6.271a5.033 5.033 0 0 0-.628-1.217l-4.428-6.295a4.998 4.998 0 0 0-1.522-1.413l-10.816-6.474a5.002 5.002 0 0 0-2.567-.709h-7.741c-.261 0-.522-.021-.78-.062l-10.954-1.73a4.995 4.995 0 0 0-1.775.039l-8.092 1.643a5.014 5.014 0 0 0-1.041.334l-10.329 4.606a5 5 0 0 0-1.309.85l-10.71 9.642a5 5 0 0 0-1.476 5.043l2.83 10.278a5.003 5.003 0 0 1-.136 3.072l-3.212 8.626a4.784 4.784 0 0 0-.301 1.67c0 4.557-5.766 6.535-8.563 2.938l-.66-.848a5.054 5.054 0 0 1-.508-.8l-9.298-18.253-5.853-9.982a5.005 5.005 0 0 1-.602-3.444l1.431-7.684a5.003 5.003 0 0 0-.276-2.78l-4.459-11.092a5.011 5.011 0 0 0-1.305-1.861l-10.022-8.969a5.004 5.004 0 0 1-1.61-2.981l-5.207-34.538a5 5 0 0 0-4.944-4.255h-3.407c-.741 0-1.472.164-2.141.482l-8.291 3.928a5.001 5.001 0 0 0-2.858 4.624l1.262 59.784c.019.903.282 1.784.762 2.549l11.842 18.9c.224.358.402.743.53 1.146l3.886 12.274 8.68 26.576c.103.314.236.618.399.905l15.387 27.26 6.49 8.714a4.997 4.997 0 0 1 .639 4.826l-9.168 23.169-11.407 26.069a4.954 4.954 0 0 0-.243.69l-5.341 19.611-11.553 39.285-5.355 29.177c-.054.298-.082.6-.082.903v14.626c0 .25.019.499.056.746l5.243 34.779a4.99 4.99 0 0 1-.061 1.819Z" fill="#FB0859" stroke="#FB0859" stroke-width="4"/>'
        )
      );
  }

  function _generateFujiLogo() internal pure returns (string memory) {
    return
      string(
        abi.encodePacked(
          '<g transform="translate(40, 40) scale(.06 .06)">',
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
          '<g transform="translate(425,195) scale(.6 .6)">',
            '<path d="M12.9951 25.3796V109.105C12.9951 111.022 14.0915 112.77 15.8173 113.606L51.491 130.867C52.9587 131.577 54.6806 131.527 56.1046 130.733L89.4533 112.13C91.055 111.236 92.0389 109.538 92.0172 107.704L91.04 25.2078C91.0186 23.3995 90.0225 21.7438 88.435 20.8777L56.1188 3.24721C54.6861 2.46557 52.962 2.43237 51.5003 3.15828L15.7712 20.9014C14.0706 21.7459 12.9951 23.4808 12.9951 25.3796Z" stroke="white" stroke-width="4"/>',
            '<path d="M12.9951 24.3599L50.359 44.3797C51.8698 45.1892 53.6899 45.1684 55.1818 44.3246L90.4818 24.3599" stroke="white" stroke-width="4"/>',
            '<path d="M51.8283 45.6727L16.2457 64.7381C14.8466 65.4878 14.8364 67.4904 16.228 68.2542L50.3473 86.9815C51.8634 87.8137 53.7019 87.8032 55.2085 86.954L88.4008 68.2431C89.766 67.4735 89.7559 65.5042 88.3829 64.7486L53.7371 45.6834C53.1436 45.3568 52.4253 45.3528 51.8283 45.6727Z" stroke="white" stroke-width="4"/>',
            '<path d="M52.7861 44.6401V87.2801" stroke="white" stroke-width="4"/>',
            '<path d="M93.623 10.8402L99.0752 14.9015C99.6231 15.3097 100.082 15.8257 100.422 16.4179L101.334 18.0025C101.77 18.761 102 19.6208 102 20.4959V24.8802" stroke="white" stroke-width="4"/>',
            '<path d="M2 109.12V112.463C2 113.004 2.08775 113.542 2.25984 114.054L3.19398 116.838C3.44169 117.576 3.85832 118.246 4.41069 118.794L5.75247 120.127C6.04205 120.415 6.36574 120.666 6.71634 120.875L11.4241 123.68" stroke="white" stroke-width="4"/>',
        '</g>'
        )
      );
  }

  function _generateClimberName(uint256 tokenId_) internal view returns(string memory) {
    string memory climber = _getOwnerAddress(tokenId_);
    return
    string(
      abi.encodePacked(
        '<g font-family="sans-serif" fill="#FFF">',
          '<text font-size="38" font-weight="700" transform="translate(230 475)"><tspan x="0" y="0">Climber</tspan></text>',
          '<text font-size="35" font-weight="200" transform="translate(200 475)"><tspan x="0" y="40">',climber,'</tspan></text>',
        '</g>'
      )
    );
  }

  function _generateAltitudePoints(uint256 tokenId_) internal view returns(string memory) {
    return
      string(
        abi.encodePacked(
          '<g font-family="sans-serif" fill="#FFF">',
            '<text font-size="28" font-weight="700" transform="translate(405 310)"><tspan x="0" y="0">Altitude</tspan></text>',
            '<text font-size="45" font-weight="200" transform="translate(405 310)"><tspan x="0" y="40">', _getAltitudePoints(tokenId_),'</tspan></text>',
         '</g>'
        )
      );
  }

  function _generateDefs() internal pure returns(string memory) {
    return
      string(
        abi.encodePacked(
          '<defs>',
            '<linearGradient id="a" x1="287" y1="42" x2="287" y2="320" gradientUnits="userSpaceOnUse">',
              '<stop offset=".32" stop-color="#E3ECFA"/>',
              '<stop offset=".86" stop-color="#ECB801" stop-opacity="0"/>',
            '</linearGradient>',
          '</defs>'
        )
      );
  }

  function _getOwnerAddress(uint256 tokenId) internal view returns(string memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId);
    return ownedBy.addressToString();
  }

  function _getAltitudePoints(uint256 tokenId) internal view returns(string memory) {
    address ownedBy = nftGame.ownerOfLockNFT(tokenId);
    ( , , , ,uint128 finalScore, , ) = nftGame.userdata(ownedBy);
    return uint256(finalScore).toString();
  }

  function _hasNickname(address user) internal view returns(bool named) {
        string memory name = nicknames[user];
        if (bytes(name).length != 0) {
            named = true;
        }
    }

  function _getStringByteSize(string calldata _string) internal pure returns (uint256) {
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