// SPDX-License-Identifier: MIT

/// @title NFT Bond Logic
/// @author fuji-dao.eth
/// @notice Contract that handles logic for the NFT Bond game 

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract NFTBondLogic is ERC1155 {

    struct UserData {
        uint64 lastTimestampUpdate;
        uint64 rateOfAccrual;
        uint128 accruedPoints;
        uint128 multiplierValue; 
    }

    // Sate Variables

    uint64 public gameLaunchTimestamp;

    bytes32 public merkleRoot;

    mapping (address => UserData) public userdata;

    address[] public validVaults;

    uint256 private MINIMUM_DAILY_DEBT_POSITION = 1; //tbd
    uint256 private POINT_PER_DEBTUNIT_PER_DAY = 1; //tbd
    uint256 private MULTIPLIER_RATE = 1; //tbd

    constructor(string memory uri_) ERC1155(uri_) {
    }

    // View Functions

    /**
    * @notice Compute user's total debt in Fuji in all vaults of this chain.
    * @dev Must consider all fuji active vaults, and different decimals. 
    */
    function balanceOf(address user, uint256 id) public pure override returns(uint256){
        // To query points balance, id == 0
        if(id == 0 ) {
            return _pointsBalanceOf(user);
        } else {

        }
    }

    /**
    * @notice Compute user's accrued points since user's 'lastTimestampUpdate'.
    */
    function computeAccrued() public pure returns(uint256) {
        return 1;
    }

    /**
    * @notice Compute user's total debt in Fuji in all vaults of this chain.
    * @dev Must consider all fuji active vaults, and different decimals. 
    */
    function getUserDebt() public pure returns(uint256){
        return 1;
    }

    // State Changing Functions
    
    /**
    * @notice Compute user's total debt in Fuji in all vaults of this chain.
    * @dev Must consider all fuji active vaults, and different decimals. 
    */
    function checkStateOfPoints() external {
        // 1.- Check 'getUserDebt()'.
        // 2.- 
    }

    // Internal Functions

    function _pointsBalanceOf(address user) internal pure returns(uint256){
        user;
        // 1.- Get user's accruedPoints
        // 2.- Get 'computeAccrued()'
        // 3.- add the values from 1 and 2 and return it.
        return 1;
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal pure override {
        operator;
        from;
        to;
        ids;
        amounts;
        data;
    }



}