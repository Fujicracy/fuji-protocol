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

  struct Details {
    bytes name;
    bytes tokenDescription;
    string underlying;
    string slotDesc;
    string claimDate;
    uint256 slotId;
    uint256 redeemableTokens;
  }

  // '_bondSlotTimes' as defined in {PretokenBonds.sol} => short string description of vesting time
  mapping(uint256 => string) private _slotDetails;

  // VoucherSVG
  IVoucherSVG public voucherSVG;

  NFTGame private nftGame;
  PreTokenBonds private voucher;

  // Variables set at deployment
  string private _pretokenbondName;
  bytes32 private _nftgame_GAME_ADMIN;

  constructor(
    address _nftGame,
    address _pretokenBonds
  ) {
    nftGame = NFTGame(_nftGame);
    voucher = PreTokenBonds(_pretokenBonds);
    _pretokenbondName = voucher.name();
    _slotDetails[3] = '3 Month-expiry Bond';
    _slotDetails[6] = '6 Month-expiry Bond';
    _slotDetails[12] = '12 Month-expiry Bond';
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
   * @notice Admin restricted function to set address for PreTokenBonds contract
   */
  function setPreTokenBonds(address _pretokenBonds) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    require(_pretokenBonds != address(0), GameErrors.INVALID_INPUT);
    voucher = PreTokenBonds(_pretokenBonds);
    emit PreTokenBondsChanged(_pretokenBonds);
  }
  /**
   * @notice Admin restricted function to set address for VoucherSVG contract
   */
  function setVoucherSVG(address _voucherSVG) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    voucherSVG = IVoucherSVG(_voucherSVG);
    emit SetVoucherSVG(_voucherSVG);
  }
  /**
   * @notice Admin restricted function to set short string describing SlotId
   */
  function setSlotDetailString(uint256 _slotId, string memory desc) external {
    require(nftGame.hasRole(_nftgame_GAME_ADMIN, msg.sender), GameErrors.NOT_AUTH);
    _slotDetails[_slotId] = desc;
    emit SlotDetailChanges(_slotId, desc);
  }

  /// View Functions

  function contractURI() external view override returns (string memory) {
    return
      string(
        abi.encodePacked(
          'data:application/json;{"name":"', _pretokenbondName,
          '","description":"', _contractDescription(),
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

  function tokenURI(uint256 _tokenId) external view override returns (string memory) {
    Details memory tokenIdDetails = _buildDetails(_tokenId);
    string memory image = voucherSVG.generateSVG(address(voucher), _tokenId);
    return string(
      abi.encodePacked(
        "data:application/json;base64,",
        Base64.encode(
          abi.encodePacked(
            '{"name":"', tokenIdDetails.name,
            '","description":"', tokenIdDetails.tokenDescription,
            '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(image)),
            '","bond units":"', voucher.unitsInToken(_tokenId).toString(),
            '","slot":"', tokenIdDetails.slotId.toString(),
            '","properties":', _properties(tokenIdDetails),
            "}"
          )
        )
      )
    );
  }

  /// Internal functions

  function _contractDescription() private view returns (bytes memory) {
    string memory underlyingSymbol = ERC20(voucher.underlying()).symbol();
    return
      abi.encodePacked(
        unicode"⚠️ ", _descAlert(), "\\n\\n",
        "Pre-token Voucher of ", underlyingSymbol, ". ",
        _descVoucher(), "\\n\\n",
        _descProtocol()
      );
  }

  function _buildDetails(uint256 _tokenId) internal view returns(Details memory detailed) {
    detailed.name = abi.encodePacked(_pretokenbondName, " #", _tokenId.toString());
    detailed.tokenDescription = _tokenDescription(_tokenId);
    detailed.slotId = voucher.slotOf(_tokenId);
    detailed.underlying = voucher.underlying().addressToString();
    detailed.slotDesc = _slotDetails[detailed.slotId];
    detailed.claimDate = voucher.vestingTypeToTimestamp(detailed.slotId).dateToString();
    detailed.redeemableTokens = voucher.tokensPerUnit(detailed.slotId) * voucher.unitsInToken(_tokenId);
  }

  function _tokenDescription(
    uint256 tokenId
  ) private view returns (bytes memory) {
    string memory underlyingSymbol = ERC20(voucher.underlying()).symbol();
    return
      abi.encodePacked(
        unicode"⚠️ ", _descAlert(), "\\n\\n",
        "Fuji Pre-token Bond Voucher #", tokenId.toString(), " of ", underlyingSymbol, ". ",
        _descVoucher(), "\\n\\n",
        abi.encodePacked(
          "- Voucher Address: ", address(voucher).addressToString(), "\\n",
          "- Underlying Address: ", voucher.underlying().addressToString(), "\\n"
        )
      );
  }

  function _properties(Details memory detailed)
    internal
    pure
    returns (bytes memory data)
  {
    return
      abi.encodePacked(
          "{",
          '"underlyingToken":"', detailed.underlying,
          '","claimType":"OneTime"',
          '","vesting time":"', detailed.slotDesc,
          '","claim date":"', detailed.claimDate,
          '","redeemable Tokens":"', detailed.redeemableTokens,
          "}"
      );
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
