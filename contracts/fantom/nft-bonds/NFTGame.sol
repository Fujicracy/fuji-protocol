// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/// @title NFT Game 
/// @author fuji-dao.eth
/// @notice Contract that handles logic for the NFT Bond game

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../../interfaces/IVault.sol";
import "../../interfaces/IVaultControl.sol";
import "../../interfaces/IERC20Extended.sol";

contract NFTGame is Initializable, ERC1155Upgradeable, AccessControlUpgradeable {

  /**
  * @dev Changing valid vaults
  */
  event ValidVaultsChanged(address[] validVaults);

  struct UserData {
    uint64 lastTimestampUpdate;
    uint64 rateOfAccrual;
    uint128 accruedPoints;
    uint128 recordedDebtBalance;
  }

  // Constants

  uint256 constant SEC = 86400;

  // uint256 private constant MINIMUM_DAILY_DEBT_POSITION = 1;
  // uint256 private constant POINT_PER_DEBTUNIT_PER_DAY = 1; 

  uint256 public constant POINTS_ID = 0;
  uint256 public constant POINTS_DECIMALS = 5;

  address private constant _FTM = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;


  // Roles

  bytes32 public constant GAME_ADMIN = keccak256("GAME_ADMIN");
  bytes32 public constant GAME_INTERACTOR = keccak256("GAME_INTERACTOR");


  // Sate Variables

  uint64 public gameLaunchTimestamp;
  bytes32 public merkleRoot;

  mapping(address => UserData) public userdata;

  // TokenID =>  supply amount
  mapping(uint256 => uint256) public totalSupply;

  address[] public validVaults;

  modifier onlyVault() {
    bool isVault;
    for (uint256 i = 0; i < validVaults.length && !isVault; i++) {
      isVault = msg.sender == validVaults[i] ? true : false;
    }
    require(isVault == true, "only valid vault caller!");
    _;
  }

  function initialize() external initializer {
    __ERC1155_init("");
    __AccessControl_init();
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(GAME_ADMIN, msg.sender);
    _setupRole(GAME_INTERACTOR, msg.sender);
  }

  // State Changing Functions

  /**
  * @notice Sets the list of vaults that count towards the game
  */
  function setValidVaults(address[] memory vaults) external {
    require(hasRole(GAME_ADMIN, msg.sender), "No permission");
    validVaults = vaults;
    emit ValidVaultsChanged(vaults);
  }

  /**
  * @notice Compute user's total debt in Fuji in all vaults of this chain.
  * @dev Called whenever a user performs a 'borrow()' or 'payback()' call on {FujiVault} contract
  * @dev Must consider all fuji active vaults, and different decimals.
  */
  function checkStateOfPoints(
    address user,
    uint256 balanceChange,
    bool isPayback,
    uint256 decimals
  ) external onlyVault {
    UserData memory info = userdata[user];
    uint256 debt = getUserDebt(user);

    if (info.rateOfAccrual != 0) {
      // ongoing user, ongoing game
      balanceChange = _convertToDebtUnits(balanceChange, decimals);
      _compoundPoints(user, isPayback ? debt + balanceChange : debt - balanceChange);
    }

    _updateUserInfo(user, uint128(debt));
  }

  function mint(address user, uint256 id, uint256 amount) external {
    require(hasRole(GAME_INTERACTOR, msg.sender), "No permission");

    if (id == POINTS_ID) {
      userdata[user].accruedPoints += uint128(amount);
    } else {
      _mint(user, id, amount, "");
    }
    totalSupply[id] += amount;
  }

  function burn(address user, uint256 id, uint256 amount) external {
    require(hasRole(GAME_INTERACTOR, msg.sender), "No permission");

    if (id == POINTS_ID) {
      uint256 debt = getUserDebt(user);
      _compoundPoints(user, debt);
      _updateUserInfo(user, uint128(debt));
      require(userdata[user].accruedPoints >= amount, "Not enough points");
      userdata[user].accruedPoints -= uint128(amount);
    } else {
      _burn(user, id, amount);
    }
    totalSupply[id] -= amount;
  }

  /**
  * @notice Claims bonus points given to user before 'gameLaunchTimestamp'.
  */
  function claimBonusPoints() public {}

  function setMerkleRoot(bytes32 _merkleRoot) external {
    require(hasRole(GAME_ADMIN, msg.sender), "No permission");
    require(_merkleRoot[0] != 0, "empty merkleRoot!");
    merkleRoot = _merkleRoot;
  }


  // View Functions

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
      totalDebt += _convertToDebtUnits(IVault(validVaults[i]).userDebtBalance(user), decimals);
    }
    return totalDebt;
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155Upgradeable, AccessControlUpgradeable) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  // Internal Functions

  /**
  * @notice Compute user's accrued points since user's 'lastTimestampUpdate'.
  * @dev Includes points from rate and points from interest
  */
  function _computeAccrued(address user, uint256 debt) internal view returns (uint256) {
    // 1 - compute points from normal rate
    // 2 - add points by interest
    UserData memory info = userdata[user];
    uint256 pointsFromRate = _timestampDifference(info.lastTimestampUpdate) * (info.rateOfAccrual);
    uint256 pointsFromInterest = (((debt - info.recordedDebtBalance) * _timestampDifference(info.lastTimestampUpdate)) / 2);
  
    return pointsFromRate + pointsFromInterest;
  }

  /**
  * @dev Returns de balance of accrued points of a user.
  */
  function _pointsBalanceOf(address user) internal view returns (uint256) {
    return userdata[user].accruedPoints + _computeAccrued(user, getUserDebt(user));
  }

  /**
  * @dev Adds 'computeAccrued()' to recorded 'accruedPoints' in UserData and totalSupply
  * @dev Must update all fields of UserData information.
  */
  function _compoundPoints(address user, uint256 debt) internal {
    uint256 points = _computeAccrued(user, debt);

    _mintPoints(user, points);
  }

  function _timestampDifference(uint256 oldTimestamp) internal view returns (uint256) {
    return block.timestamp - oldTimestamp;
  }

  function _convertToDebtUnits(uint256 value, uint256 decimals) internal pure returns (uint256) {
    return value / 10**decimals;
  }

  //TODO change this function for the public one with the corresponding permission
  function _mintPoints(address user, uint256 amount) internal {
    userdata[user].accruedPoints += uint128(amount);
    totalSupply[POINTS_ID] += amount;
  }

  function _updateUserInfo(address user, uint128 balance) internal {
    userdata[user].lastTimestampUpdate = uint64(block.timestamp);
    userdata[user].recordedDebtBalance = uint128(balance);
    userdata[user].rateOfAccrual = uint64(balance * (10**POINTS_DECIMALS) / SEC);
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
