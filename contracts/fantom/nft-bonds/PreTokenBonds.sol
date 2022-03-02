// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./interfaces/IERC3525.sol";
import "../libraries/AssetLibrary.sol";

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract PreTokenBonds is IERC3525, ERC721 {
  using SafeMath for uint256;
  using AssetLibrary for AssetLibrary.Asset;
  using EnumerableSet for EnumerableSet.UintSet;

  // Token ID mapping
  mapping(uint256 => AssetLibrary.Asset) public assets;

  //slot => tokenIds
  mapping (uint256 => EnumerableSet.UintSet) private _slotTokens;

  function slotOf(uint256 _tokenId) external view override returns (uint256) {
    return assets[_tokenId].slot;
  }

  function supplyOfSlot(uint256 _slot) external view override returns (uint256) {
    return _slotTokens[_slot].length();
  }

  //TODO decimals

  function tokenOfSlotByIndex(uint256 _slot, uint256 _index) external view override returns (uint256) {
    return _slotTokens[_slot].at(_index);
  }

  function unitsInToken(uint256 _tokenId) external view override returns (uint256) {
    return assets[_tokenId].units;
  }

  //TODO approve and allowance


  // function split(uint256 _tokenId, uint256[] calldata _units) external override returns (uint256[] memory) {
  //   require(_isApprovedOrOwner(_msgSender(), _tokenId), "Not owner nor approved");
  //   require(! _exists(newTokenId_), "new token already exists");

  //   assets[_tokenId].units = assets[_tokenId].units.sub(splitUnits_);
  //   address owner = ownerOf(_tokenId);
  //   _mintUnits(owner, newTokenId_, assets[_tokenId].slot, splitUnits_);

  //   emit Split(owner, _tokenId, newTokenId_, splitUnits_);
  // }

  
  // function merge(uint256[] calldata _tokenIds, uint256 _targetTokenId) override external {
  //   require(_isApprovedOrOwner(_msgSender(), tokenId_), "VNFT: not owner nor approved");
  //   require(_exists(_targetTokenId), "target token not exists");
  //   require(tokenId_ != _targetTokenId, "self merge not allowed");

  //   address owner = ownerOf(tokenId_);
  //   require(owner == ownerOf(_targetTokenId), "not same owner");

  //   uint256 mergeUnits = assets[tokenId_].merge(assets[_targetTokenId]);
  //   _burn(tokenId_);

  //   emit Merge(owner, tokenId_, _targetTokenId, mergeUnits);
  // }

  function _mintUnits(address _minter, uint256 _tokenId, uint256 _slot, uint256 _units) internal {
        if (! _exists(_tokenId)) {
            ERC721._mint(_minter, _tokenId);
        }

        assets[_tokenId].mint(_slot, _units);
        if (! _slotTokens[_slot].contains(_tokenId)) {
            _slotTokens[_slot].add(_tokenId);
        }
    }
}