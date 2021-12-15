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

    modifier onlyVault() {
        bool isVault;
        for(uint i; i < validVaults.length; i++) {
            if(isVault == false) {
                isVault = msg.sender == validVaults[i] ? true : false;
            }
        }
        require(isVault == true, 'only valid vault caller!');
        _;
    }

    constructor(string memory uri_) ERC1155(uri_) {
    }

    // View Functions

    /**
    * @notice Returns the balance of token Id.
    * @dev If id == 0, refers to point score system, else is calls ERC1155 NFT balance. 
    */
    function balanceOf(address user, uint256 id) public view override returns(uint256){
        // To query points balance, id == 0
        if(id == 0 ) {
            return _pointsBalanceOf(user);
        } else {
            // Otherwise check ERC1155
            return super.balanceOf(user,id);
        }
    }

    /**
    * @notice Compute user's accrued points since user's 'lastTimestampUpdate'.
    */
    function computeAccrued() public pure returns(uint256) {
        return 1;
    }

    /**
    * @notice Compute user's rate of point accrual.
    * @dev Unit should be points per second.
    */
    function computeRateOfAccrual() public pure returns(uint256) {
        return 1;
    }

    /**
    * @notice Compute user's total debt in Fuji in all vaults of this chain.
    * @dev Must consider all fuji active vaults, and different decimals. 
    */
    function getUserDebt() public pure returns(uint256){
        // 1.- Get debt from all 'validVaults'.
        // 2.- Add and return value
        return 1;
    }

    // State Changing Functions
    
    /**
    * @notice Compute user's total debt in Fuji in all vaults of this chain.
    * @dev Called whenever a user performs a 'borrow()' or 'payback()' call on {FujiVault} contract
    * @dev Must consider all fuji active vaults, and different decimals. 
    */
    function checkStateOfPoints(address user) external onlyVault {
        // 1.- Call and store 'getUserDebt()'.
        // 2.- Call and check if user exist in mapping 'userdata'.
    }

    /**
    * @notice Claims bonus points given to user before 'gameLaunchTimestamp'.
    */
    function claimBonusPoints() public {

    }

    function setMerkleRoot(bytes32 _merkleRoot) external {
        require(_merkleRoot[0] != 0, 'empty merkleRoot!');
        merkleRoot = _merkleRoot;
    }

    // Internal Functions

    /**
    * @dev Returns de balance of accrued points of a user.
    */
    function _pointsBalanceOf(address user) internal pure returns(uint256){
        user;
        // 1.- Get user's accruedPoints
        // 2.- Get 'computeAccrued()'
        // 3.- add the values from 1 and 2 and return it.
        return 1;
    }

    /**
    * @dev Adds 'computeAccrued()' to recorded 'accruedPoints' in UserData.
    * @dev Must update all fields of UserData information.
    */
    function _compoundPoints() internal {
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