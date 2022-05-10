// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

/**
 * @dev Contract based on:
 * https://github.com/solv-finance/solv-v2-ivo/blob/main/vouchers/convertible-voucher/contracts/ConveritbleVoucherDescriptor.sol
 */
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./interfaces/IVNFTDescriptor.sol";
import "./interfaces/IVoucherSVG.sol";
import "./NFTGame.sol";
import "./PreTokenBonds.sol";
import "./libraries/GameErrors.sol";
import "./libraries/StringConvertor.sol";
import "./libraries/Base64.sol";

contract VoucherDescriptor is IVNFTDescriptor, Context {
  using StringConvertor for address;
  using StringConvertor for uint256;
  using StringConvertor for bytes;

  // '_bondSlotTimes' as defined in {PretokenBonds.sol} => short string description of vesting time
  mapping(uint256 => string) _slotDetails;

  // VoucherSVG address
  address public voucherSVG;

  uint256 public immutable chainID;

  uint256 public immutable gameEdition;

  NFTGame private nftGame;

  bytes32 private _nftgame_GAME_ADMIN;

  constructor(
    address _nftGame,
    uint256 _chainID,
    uint256 _gameEdition
  ) {
    nftGame = NFTGame(_nftGame);
    chainID = _chainID;
    gameEdition = _gameEdition;
  }

  /// Admin Functions

  /**
   * @notice Admin restricted function to set address for NFTGame contract
   */
  function setNFTGame(address _nftGame) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(_nftGame != address(0), GameErrors.INVALID_INPUT);
    nftGame = NFTGame(_nftGame);
    emit NFTGameChanged(_nftGame);
  }

  /**
   * @notice Admin restricted function to set address for VoucherSVG contract
   */
  function setVoucherSVG(address _voucherSVG) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    voucherSVG = _voucherSVG;
    emit SetVoucherSVG(_voucherSVG);
  }

  function setSlotDetailString(uint256 _slotId, string memory desc) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    _slotDetails[_slotId] = desc;
    emit SlotDetailChanges(_slotId, desc);
  }

  /// View Functions

  function contractURI() external view override returns (string memory) {
    PreTokenBonds voucher = PreTokenBonds(_msgSender());
    return
      string(
        abi.encodePacked(
          'data:application/json;{"name":"', voucher.name(),
          '","description":"', _contractDescription(voucher),
          '","unitDecimals":"', uint256(voucher.unitDecimals()).toString(),
          '","properties":{}}'
        )
      );
  }

  function slotURI(uint256 slot) external pure override returns (string memory) {
    slot;
    // TODO
    return "";
  }

  function tokenURI(uint256 tokenId) external view override returns (string memory) {
    PreTokenBonds voucher = PreTokenBonds(_msgSender());
    uint256 slot = voucher.slotOf(tokenId);
    bytes memory name = abi.encodePacked(voucher.name(), " #", tokenId.toString());
    string memory image = IVoucherSVG(voucherSVG).generateSVG(_msgSender(), tokenId);
    return _tokenURI(name, voucher, tokenId, slot, image);
  }

  /// Internal functions

  function _contractDescription(PreTokenBonds voucher) private view returns (bytes memory) {
    string memory underlyingSymbol = ERC20(voucher.underlying()).symbol();
    return
      abi.encodePacked(
        unicode"⚠️ ", _descAlert(), "\\n\\n",
        "Pre-token Voucher of ", underlyingSymbol, ". ",
        _descVoucher(), "\\n\\n",
        _descProtocol()
      );
  }

  function _tokenURI(
    bytes memory _name,
    PreTokenBonds _voucher,
    uint256 _tokenId,
    uint256 _slot,
    string memory image
  ) internal view returns (string memory) {
    string memory _slotDetail = _getSlotDetail(_slot);
    return
      string(
        abi.encodePacked(
          "data:application/json;base64,",
          Base64.encode(
            abi.encodePacked(
              '{"name":"', _name,
              '","description":"', _tokenDescription(_voucher, _tokenId, _slotDetail),
              '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(image)),
              '","bond units":"', _voucher.unitsInToken(_tokenId).toString(),
              '","slot":"', _slot.toString(),
              '","properties":', _properties(_voucher, _slot),
              "}"
            )
          )
        )
      );
  }

  function _tokenDescription(
    PreTokenBonds voucher,
    uint256 tokenId,
    string memory slotDetail
  ) private view returns (bytes memory) {
    string memory underlyingSymbol = ERC20(voucher.underlying()).symbol();
    return
      abi.encodePacked(
        unicode"⚠️ ", _descAlert(), "\\n\\n",
        "Fuji Pre-token Bond Voucher #", tokenId.toString(), " of ", underlyingSymbol, ". ",
        _descVoucher(), "\\n\\n",
        abi.encodePacked(
          "- Voucher Address: ", address(voucher).addressToString(), "\\n",
          "- Underlying Address: ", voucher.underlying().addressToString(), "\\n",
          "- Vesting time: ", slotDetail
        )
      );
  }

  function _properties(PreTokenBonds voucher, uint256 _slotId)
    private
    view
    returns (bytes memory data)
  {
    return
      abi.encodePacked(
        abi.encodePacked(
          '{"underlyingToken":"', voucher.underlying().addressToString()
        ),
        abi.encodePacked(
          '","claimType":"', 'One-time',
          '","vesting time":"', _getSlotDetail(_slotId),
          '","claim date":"', _getClaimDate(voucher, _slotId),
          '","chain ID":"', chainID.toString(),
          '","game edition":"', gameEdition.toString()
        )
      );
  }

  function _getSlotDetail(uint256 _slotID) internal view returns (string memory) {
    return _slotDetails[_slotID];
  }

  function _getClaimDate(
    PreTokenBonds voucher,
    uint256 _slotId
  ) internal view returns (string memory) {
    return voucher.vestingTypeToTimestamp(_slotId).datetimeToString();
  }

  function _descAlert() private pure returns (string memory) {
    return
      "**Alert**: The amount of bonds in this Voucher NFT may be out of date due to certain mechanisms of third-party marketplaces, thus leading to mis-price the NFT on this page. Please ensure viewing this Voucher on [Solv Protocol dApp](https://app.solv.finance)";
  }

  function _descVoucher() private pure returns (string memory) {
    return
      "The Fuji Pre-token Bond Voucher is a Financial NFT (powered by Solv Finance), which contain bonds that the Fuji protocol is issuing to its active borrowers. Depending on the selected vesting time, each bond is redeemable for a specific amount of Fuji future tokens at expiry.";
  }

  function _descProtocol() private pure returns (string memory) {
    return
      "Fuji is a protocol that aggregates lending-borrowing crypto markets. The protocol value-add proposition is to optimize interest rates for its users (both borrowers and lenders) by automating routing and movement of funds across lending-borrowing protocols and blockchain networks in search of the best APR.";
  }
}
