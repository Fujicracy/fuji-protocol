//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.2;

library LibPseudoRandom {

    uint256 private constant decimals = 6;

    /**
   * @dev Returns amount of requested picks of a pseudo-random number between 0 and 1.
   * @dev Decimals is defined by constant.
   * @param amountOfPicks number of random picks to return.
   * @return results array of picks.
   */
    function pickRandomNumbers(uint256 amountOfPicks) internal view returns (uint256[] memory results){
        require(amountOfPicks > 0, "Invalid amountOfPicks!");
        results = new uint[](amountOfPicks);
        for(uint i = 0; i < results.length; i++ ){
            results[i] = pickProbability(i);
        }
    }

    function pickProbability(uint256 nonce) private view returns (uint256 index) {
        index = random(nonce) % 10**decimals + 1;
    }

    function random(uint256 nonce) private view returns (uint256) {
            return uint256(keccak256(abi.encodePacked(block.difficulty, block.timestamp, block.coinbase, nonce)));
    }


}
