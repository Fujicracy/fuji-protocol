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
    string claimDate;
    uint256 slotId;
    uint256 redeemableTokens;
  }

  // VoucherSVG
  IVoucherSVG public voucherSVG;

  NFTGame private nftGame;
  PreTokenBonds private voucher;

  // Variables set at deployment
  string private _pretokenbondName;
  bytes32 private _nftgame_GAME_ADMIN;

  constructor(
    address _nftGame,
    address _pretokenBonds,
    address _voucherSVG
  ) {
    nftGame = NFTGame(_nftGame);
    _nftgame_GAME_ADMIN = nftGame.GAME_ADMIN();
    voucher = PreTokenBonds(_pretokenBonds);
    _pretokenbondName = voucher.name();
    voucherSVG = IVoucherSVG(_voucherSVG);
  }

  /// Admin Functions

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

  function slotURI(uint256 _slot) external view override returns (string memory) {
    Details memory slotIdDetails = _buildDetailsSlot(_slot);
    return 
      string(
        abi.encodePacked(
          'data:application/json;{"unitsInSlot":"', voucher.unitsInSlot(_slot).toString(),
          '","tokensInSlot":"', voucher.tokensInSlot(_slot).toString(),
          '","properties":', _propertiesSlot(slotIdDetails),
          '}'
        )
      );
  }

  function tokenURI(uint256 _tokenId) external view override returns (string memory) {
    Details memory tokenIdDetails = _buildDetailsToken(_tokenId);
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
            '","properties":', _propertiesToken(tokenIdDetails),
            "}"
          )
        )
      )
    );
  }

  /// Internal functions

  function _contractDescription() private pure returns (bytes memory) {
    return
      abi.encodePacked(
        _descVoucher(), "\\n\\n",
        _descProtocol(), "\\n\\n",
        unicode"⚠️ ", _descAlert()
      );
  }

  function _buildDetailsToken(uint256 _tokenId) internal view returns(Details memory detailed) {
    detailed.name = abi.encodePacked(_pretokenbondName, " #", _tokenId.toString());
    detailed.tokenDescription = _tokenDescription();
    detailed.slotId = voucher.slotOf(_tokenId);
    detailed.underlying = voucher.underlying().addressToString();
    detailed.claimDate = voucher.vestingTypeToTimestamp(detailed.slotId).dateToString();
    detailed.redeemableTokens = voucher.tokensPerUnit(detailed.slotId) * voucher.unitsInToken(_tokenId);
  }

  function _buildDetailsSlot(uint256 _slotId) internal view returns(Details memory detailed) {
    detailed.underlying = voucher.underlying().addressToString();
    detailed.slotId = _slotId;
    detailed.claimDate = voucher.vestingTypeToTimestamp(_slotId).dateToString();
  }

  function _tokenDescription() private view returns (bytes memory) {
    return
      abi.encodePacked(
        _descVoucher(), "\\n\\n",
        unicode"⚠️ ", _descAlert(), "\\n\\n",
        abi.encodePacked(
          "- Voucher Address: ", address(voucher).addressToString(), "\\n",
          "- Underlying Address: ", voucher.underlying().addressToString(), "\\n"
        )
      );
  }

  function _propertiesToken(Details memory detailed)
    internal
    pure
    returns (bytes memory data)
  {
    return
      abi.encodePacked(
          "{",
          '"underlyingToken":"', detailed.underlying,
          '","claimType":"OneTime',
          '","vesting time":"', detailed.slotId.toString(),' Month-expiry Bond',
          '","claim date":"', detailed.claimDate,
          '","redeemable Tokens":"', detailed.redeemableTokens.toString(),
          '"}'
      );
  }

  function _propertiesSlot(Details memory detailed)
    internal
    pure
    returns (bytes memory data)
  {
    return
      abi.encodePacked(
          "{",
          '"underlyingToken":"', detailed.underlying,
          '","claimType":"OneTime"',
          '","vesting time":"', detailed.slotId.toString(),' Month-expiry Bond',
          '","claim date":"', detailed.claimDate,
          '"}'
      );
  }

  function _descAlert() private pure returns (string memory) {
    return
      "**Alert**: The amount of bonds in this Voucher NFT may be out of date due to certain mechanisms of third-party marketplaces. Please ensure viewing this Voucher on [Solv Protocol dApp](https://app.solv.finance)";
  }

  function _descVoucher() private pure returns (string memory) {
    return
      "The Fuji Pre-token Bond Voucher is a Financial NFT (powered by Solv Finance), which contain bonds that the [Fuji protocol](https://fujidao.org) is issuing to its active borrowers. Depending on the selected vesting time, each bond is redeemable for a specific amount of Fuji future tokens at expiry.";
  }

  function _descProtocol() private pure returns (string memory) {
    return
      "[Fuji](https://fujidao.org) is a protocol that aggregates lending-borrowing crypto markets. The protocol value-add proposition is to optimize interest rates for its users (both borrowers and lenders) by automating routing and movement of funds across lending-borrowing protocols and blockchain networks in search of the best APR.";
  }
}
