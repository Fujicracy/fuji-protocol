// SPDX-License-Identifier: MIT

/// @title NFT Bond Logic
/// @author fuji-dao.eth
/// @notice Contract that handles logic for the NFT Bond game 

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import "../../interfaces/IVault.sol";
import "../../interfaces/IVaultControl.sol";
import "../../interfaces/IERC20Extended.sol";

contract NFTBondLogic is ERC1155 {

    struct UserData {
        uint64 lastTimestampUpdate;
        uint64 rateOfAccrual;
        uint128 accruedPoints;
        uint128 multiplierValue;
        uint128 recordedDebtBalance;
    }

    uint constant SEC = 86400;

    // Sate Variables

    uint64 public gameLaunchTimestamp;

    bytes32 public merkleRoot;

    mapping (address => UserData) public userdata;

    // TokenID =>  supply amount
    mapping (uint256 => uint256) public totalSupply;

    address[] public validVaults;

    uint256 private MINIMUM_DAILY_DEBT_POSITION = 1; //tbd
    uint256 private POINT_PER_DEBTUNIT_PER_DAY = 1; //tbd
    uint256 private MULTIPLIER_RATE = 1; //tbd

    modifier onlyVault() {
        bool isVault;
        for(uint i = 0; i < validVaults.length && !isVault; i++) {
            isVault = msg.sender == validVaults[i] ? true : false;
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
            return super.balanceOf(user, id);
        }
    }

    /**
    * @notice Compute user's accrued points since user's 'lastTimestampUpdate'.
    */
    function computeAccrued(address user) public view returns(uint256) {
        UserData memory info = userdata[user];
        return (block.timestamp - info.lastTimestampUpdate) * info.rateOfAccrual * POINT_PER_DEBTUNIT_PER_DAY;
    }

    /**
    * @notice Compute user's rate of point accrual.
    * @dev Unit should be points per second.
    */
    function computeRateOfAccrual(address user) public view returns(uint256) {
        return getUserDebt(user) / SEC;
    }

    /**
    * @notice Compute user's (floored) total debt in Fuji in all vaults of this chain.
    * @dev Must consider all fuji's active vaults, and different decimals.
    * @dev This function floors decimals to the nearest integer amount of debt. Example 1.78784 usdc = 1 unit of debt
    */
    function getUserDebt(address user) public view returns(uint256){
        uint totalDebt = 0;

        IVaultControl.VaultAssets memory vAssets; 
        uint decimals;
        for(uint i = 0; i < validVaults.length; i++) {
            vAssets = IVaultControl(validVaults[i]).vAssets();
            decimals = IERC20Extended(vAssets.borrowAsset).decimals();

            totalDebt += IVault(validVaults[i]).userDebtBalance(user) / 10^decimals;
        }
        return totalDebt;
    }

    // State Changing Functions
    
    /**
    * @notice Compute user's total debt in Fuji in all vaults of this chain.
    * @dev Called whenever a user performs a 'borrow()' or 'payback()' call on {FujiVault} contract
    * @dev Must consider all fuji active vaults, and different decimals. 
    */
    function checkStateOfPoints(address user, uint balanceChange, bool addOrSubstract) external onlyVault {
        UserData storage info = userdata[user];

        //if points == 0, new user, just set the rate

        if (info.accruedPoints != 0 && info.rateOfAccrual == 0) {
            // ongoing user, first time game (claimed bonus already)

            // extract from merkel tree

        } else if (info.accruedPoints != 0 && info.rateOfAccrual != 0) {
            // ongoing user, ongoing game

            _compoundPoints(user);
        } 

        // Set rate
        info.rateOfAccrual = uint64(computeRateOfAccrual(user));
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
    function _pointsBalanceOf(address user) internal view returns(uint256){
        return userdata[user].accruedPoints + computeAccrued(user);
    }

    /**
    * @dev Adds 'computeAccrued()' to recorded 'accruedPoints' in UserData and totalSupply
    * @dev Must update all fields of UserData information.
    */
    function _compoundPoints(address user) internal {
        UserData storage info = userdata[user];
        info.accruedPoints += uint128(computeAccrued(user));
        info.lastTimestampUpdate = uint64(block.timestamp);

        // TODO Need to keep track of totalSupply of points.
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