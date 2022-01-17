// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @title NFT Bond Logic
/// @author fuji-dao.eth
/// @notice Contract that handles logic for the NFT Bond game

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import "../../interfaces/IVault.sol";
import "../../interfaces/IVaultControl.sol";
import "../../interfaces/IERC20Extended.sol";

contract NFTBond is ERC1155 {
  struct UserData {
    uint64 lastTimestampUpdate;
    uint64 rateOfAccrual;
    uint128 accruedPoints;
    // uint128 lastMultiplierValue;
    uint128 recordedDebtBalance;
  }

  uint256 constant SEC = 86400;

  // Sate Variables

  uint64 public gameLaunchTimestamp;

  bytes32 public merkleRoot;

  mapping(address => UserData) public userdata;

  // TokenID =>  supply amount
  mapping(uint256 => uint256) public totalSupply;

  address[] public validVaults;

  uint256 private constant MINIMUM_DAILY_DEBT_POSITION = 1; //tbd
  uint256 private constant POINT_PER_DEBTUNIT_PER_DAY = 1; //tbd
  // uint256 private constant MULTIPLIER_RATE = 100000000; // tbd
  uint256 private constant CONSTANT_DECIMALS = 8; // Applies to all constants
  uint256 private constant POINTS_ID = 0;
  uint256 private constant CRATE_COMMON_ID = 1;
  uint256 private constant CRATE_EPIC_ID = 2;
  uint256 private constant CRATE_LEGENDARY_ID = 3;

  uint256 public constant POINTS_DECIMALS = 18;

  uint256[3] public cratePrices;

  address private constant _FTM = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

  modifier onlyVault() {
    bool isVault;
    for (uint256 i = 0; i < validVaults.length && !isVault; i++) {
      isVault = msg.sender == validVaults[i] ? true : false;
    }
    require(isVault == true, "only valid vault caller!");
    _;
  }

  constructor(string memory uri_) ERC1155(uri_) {}

  // View Functions

  /**
  * @notice Returns the balance of token Id.
  * @dev If id == 0, refers to point score system, else is calls ERC1155 NFT balance.
  */
  function balanceOf(address user, uint256 id) public view override returns (uint256) {
    // To query points balance, id == 0
    if (id == POINTS_ID) {
      return _pointsBalanceOf(user);
    } else {
      // Otherwise check ERC1155
      return super.balanceOf(user, id);
    }
  }

  /**
  * @notice Compute user's rate of point accrual.
  * @dev Unit should be points per second.
  */
  function computeRateOfAccrual(address user) public view returns (uint256) {
    return getUserDebt(user) * (10**POINTS_DECIMALS) / SEC;
  }

  /**
  * @notice Compute user's (floored) total debt in Fuji in all vaults of this chain.
  * @dev Must consider all fuji's active vaults, and different decimals.
  * @dev This function floors decimals to the nearest integer amount of debt. Example 1.78784 usdc = 1 unit of debt
  */
  function getUserDebt(address user) public view returns (uint256) {
    uint256 totalDebt = 0;

    IVaultControl.VaultAssets memory vAssets;
    uint256 decimals;
    for (uint256 i = 0; i < validVaults.length; i++) {
      vAssets = IVaultControl(validVaults[i]).vAssets();
      decimals = vAssets.borrowAsset == _FTM ? 18 : IERC20Extended(vAssets.borrowAsset).decimals();
      totalDebt += IVault(validVaults[i]).userDebtBalance(user) / 10**decimals;
    }
    return totalDebt;
  }

  // State Changing Functions

  /**
  * @notice Sets the list of vaults that count towards the game
  */
  function setValidVaults(address[] memory vaults) external {
    validVaults = vaults;
  }

  /**
  * @notice Checks if a given vault is a valid vault
  */
  function isValidVault(address vault) external view returns (bool){
    for (uint256 i = 0; i < validVaults.length; i++) {
      if (validVaults[i] == vault) {
        return true;
      }
    }
    return false;
  }

  /**
  * @notice Compute user's total debt in Fuji in all vaults of this chain.
  * @dev Called whenever a user performs a 'borrow()' or 'payback()' call on {FujiVault} contract
  * @dev Must consider all fuji active vaults, and different decimals.
  */
  function checkStateOfPoints(
    address user,
    uint256 balanceChange,
    bool addOrSubtract
  ) external onlyVault {
    UserData memory info = userdata[user];
    uint256 debt = getUserDebt(user);

    if (info.rateOfAccrual != 0) {
      // ongoing user, ongoing game
      _compoundPoints(user, addOrSubtract ? debt - balanceChange : debt + balanceChange);
    }

    // Set User parameters
    userdata[user].lastTimestampUpdate = uint64(block.timestamp);
    userdata[user].rateOfAccrual = uint64(debt * (10**POINTS_DECIMALS) / SEC);
    userdata[user].recordedDebtBalance = uint128(debt);
  }

  /**
  * @notice Claims bonus points given to user before 'gameLaunchTimestamp'.
  */
  function claimBonusPoints() public {}

  function setMerkleRoot(bytes32 _merkleRoot) external {
    require(_merkleRoot[0] != 0, "empty merkleRoot!");
    merkleRoot = _merkleRoot;
  }

  /**
  * @notice sets the prices for the crates
  @ dev indexes: 0 - common, 1 - epic, 2 - legendary
  */
  function setCratePrices(uint256[3] memory prices) external {
    cratePrices = prices;
  }

  /**
  * @notice Burns user points to mint a new crate
  * @param rarity: common (0), epic (1), legendary (2)
  */
  function buyCrate(uint256 rarity, uint256 amount) external {
    require(rarity == 0 || rarity == 1 || rarity == 2, "Invalid rarity");

    uint price = cratePrices[rarity];
    require(_pointsBalanceOf(msg.sender) >= price * amount, "Not enough points");

    _compoundPoints(msg.sender, getUserDebt(msg.sender));
    userdata[msg.sender].accruedPoints -= uint128(price);

    uint id = rarity == 0 ? CRATE_COMMON_ID : rarity == 1 ? CRATE_EPIC_ID : CRATE_LEGENDARY_ID;

    _mint(msg.sender, id, amount, "");
  }

  // Internal Functions

  /**
  * @dev Returns de balance of accrued points of a user.
  */
  function _pointsBalanceOf(address user) internal view returns (uint256) {
    return userdata[user].accruedPoints + _computeAccrued(user, getUserDebt(user));
  }

  /**
  * @notice Compute user's accrued points since user's 'lastTimestampUpdate'.
  */
  function _computeAccrued(address user, uint256 debt) internal view returns (uint256) {
    UserData memory info = userdata[user];
    // 1 - compute points from normal rate
    // 2 - add points by interest
    // 3 - multiply all by multiplier
    return _timestampDifference(info.lastTimestampUpdate) * (info.rateOfAccrual); // +
    // (((debt - info.recordedDebtBalance) * _timestampDifference(info.lastTimestampUpdate)) / 2); *
    // _computeLatestMultiplier(info.lastMultiplierValue, info.lastTimestampUpdate);
  }

  /**
  * @dev Adds 'computeAccrued()' to recorded 'accruedPoints' in UserData and totalSupply
  * @dev Must update all fields of UserData information.
  */
  function _compoundPoints(address user, uint256 debt) internal {
    // Read the current state of userdata
    // UserData memory info = userdata[user];

    // Change the state
    uint256 points = _computeAccrued(user, debt);
    userdata[user].accruedPoints += uint128(points);
    // userdata[user].lastMultiplierValue = uint128(_computeLatestMultiplier(info.lastMultiplierValue, info.lastTimestampUpdate));
    userdata[user].recordedDebtBalance = uint128(debt);

    totalSupply[POINTS_ID] += points;
  }

  function _timestampDifference(uint256 oldTimestamp) internal view returns (uint256) {
    return block.timestamp - oldTimestamp;
  }

  // function _computeLatestMultiplier(uint lastMultiplier, uint oldTimestamp) internal view returns(uint) {
  //     return lastMultiplier * MULTIPLIER_RATE ** (_timestampDifference(oldTimestamp)) / 10^(CONSTANT_DECIMALS);
  // }

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
