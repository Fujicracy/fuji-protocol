// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/LibPseudoRandom.sol";
import "../FujiPriceAware.sol";

contract MockRandomTests is FujiPriceAware {
  using LibPseudoRandom for uint256;

  /**
   * @notice sets allowed signer address of entropy feed.
   * Admin function required by redstone-evm-connector (oracle).
   */
  function authorizeSignerEntropyFeed(address _trustedSigner) external {
    _authorizeSigner(_trustedSigner);
  }

  /**
   * @notice sets max allowed delay between front-end call and entropy feed.
   * Admin function required by redstone-evm-connector (oracle).
   */
  function setMaxEntropyDelay(uint256 _maxDelay) external {
    _setMaxDelay(_maxDelay);
  }

  /// Internal functions

  /**
   * @notice calls redstone-oracle for entropy value.
   */
  function _getEntropy() private view returns (uint256) {
    return _getPriceFromMsg(bytes32("ENTROPY"));
  }

  /// Randomness unit test functions

  /**
   * @notice calls redstone-oracle for entropy value.
   */
  function getEntropyTest() public view returns (uint256) {
    return _getPriceFromMsg(bytes32("ENTROPY"));
  }

  /**
   * @notice returns a random number between 1 and 1e6.
   */
  function getOneRandomNumberTest() public view returns (uint256) {
    uint256 entropy = _getPriceFromMsg(bytes32("ENTROPY"));
    return LibPseudoRandom.pickRandomNumbers(1, entropy)[0];
  }

  /**
   * @notice returns a random number between 1 and 1e6.
   */
  function getManyRandomNumbersTest(uint256 howMany) public view returns (uint256[] memory) {
    uint256 entropy = _getPriceFromMsg(bytes32("ENTROPY"));
    return LibPseudoRandom.pickRandomNumbers(howMany, entropy);
  }
}
