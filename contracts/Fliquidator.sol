// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import { IVault} from "./Vaults/IVault.sol";
import { IFujiERC1155} from "./FujiERC1155/IFujiERC1155.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { Flasher } from "./Flashloans/Flasher.sol";
import { FlashLoan } from "./Flashloans/LibFlashLoan.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Errors} from "./Libraries/Errors.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { UniERC20 } from "./Libraries/LibUniERC20.sol";
import { IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import { ReentrancyGuard } from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

interface IController {
  function getvaults() external view returns(address[] memory);
}

interface IVaultext is IVault{

  //Asset Struct
  struct VaultAssets {
    address collateralAsset;
    address borrowAsset;
    uint64 collateralID;
    uint64 borrowID;
  }

  function vAssets() external view returns(VaultAssets memory);

}

contract Fliquidator is Ownable, ReentrancyGuard {

  using SafeMath for uint256;
  using UniERC20 for IERC20;

  // Base Struct Object to define a factor
  struct Factor {
    uint64 a;
    uint64 b;
  }

  // Flash Close Fee Factor
  Factor public flashCloseF;


  receive() external payable {}

  IUniswapV2Router02 public swapper;
  address public controller;
  address public flasher;
  address payable public ftreasury;

  // Log Liquidation
  event evLiquidate(address indexed userAddr, address liquidator, address indexed asset, uint256 amount);
  // Log FlashClose
  event FlashClose(address indexed userAddr, address indexed asset, uint256 amount);
  // Log Liquidation
  event FlashLiquidate(address userAddr, address liquidator, address indexed asset, uint256 amount);

  modifier isAuthorized() {
    require(
      msg.sender == owner() ||
      msg.sender == address(this),
      Errors.VL_NOT_AUTHORIZED);
    _;
  }

  modifier onlyFlash() {
    require(
      msg.sender == flasher,
      Errors.VL_NOT_AUTHORIZED);
    _;
  }

  constructor(

    address _swapper,
    address payable _ftreasury

  ) public {

    swapper = IUniswapV2Router02(_swapper);
    ftreasury = _ftreasury;

    // 1.013
    flashCloseF.a = 1013;
    flashCloseF.b = 1000;

  }

  // FLiquidator Core Functions

  /**
  * @dev Liquidate an undercollaterized debt and get bonus (bonusL in Vault)
  * @param _userAddr: Address of user whose position is liquidatable
  * @param vault: Address of the vault in where liquidation will occur
  */
  function liquidate(address _userAddr, address vault) external nonReentrant {

    // Update Balances at FujiERC1155
    IVault(vault).updateF1155Balances();

    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).getF1155());

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultext.VaultAssets memory vAssets = IVaultext(vault).vAssets();

    // Get user Collateral and Debt Balances
    uint256 userCollateral = F1155.balanceOf(_userAddr, vAssets.collateralID);
    uint256 userDebtBalance = F1155.balanceOf(_userAddr, vAssets.borrowID);

    // Compute Amount of Minimum Collateral Required including factors
    uint256 neededCollateral = IVault(vault).getNeededCollateralFor(userDebtBalance, true);

    // Check if User is liquidatable
    require(
      userCollateral < neededCollateral,
      Errors.VL_USER_NOT_LIQUIDATABLE
    );

    // Check Liquidator Allowance
    require(
      IERC20(vAssets.borrowAsset).allowance(msg.sender, address(this)) >= userDebtBalance,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );

    // Transfer borrowAsset funds from the Liquidator to Here
    IERC20(vAssets.borrowAsset).transferFrom(msg.sender, address(this), userDebtBalance);

    // Compute Split debt between BaseProtocol and FujiOptmizer Fee
    (uint256 protocolDebt,uint256 fujidebt) =
        F1155.splitBalanceOf(msg.sender, vAssets.borrowID);

    // Approve Amount to Vault
    IERC20(vAssets.borrowAsset).approve(vault, protocolDebt);

    // Repay BaseProtocol debt
    IVault(vault).payback(int256(protocolDebt));

    // Transfer Fuji Split Debt to Fuji Treasury
    IERC20(vAssets.borrowAsset).uniTransfer(ftreasury, fujidebt);

    // Burn Debt F1155 tokens
    F1155.burn(_userAddr, vAssets.borrowID, userDebtBalance);

    // Burn Collateral F1155 tokens
    F1155.burn(_userAddr, vAssets.collateralID, userCollateral);

    // Withdraw collateral
    IVault(vault).withdraw(int256(userCollateral));

    // Compute 5% of user debt
    uint256 bonus = IVault(vault).getLiquidationBonusFor(userDebtBalance, false);

    // Swap Collateral
    uint256 remainingCollat = swap(vault, userDebtBalance.add(bonus), userCollateral);

    // Transfer to Liquidator the debtBalance + bonus
    IERC20(vAssets.collateralAsset).uniTransfer(msg.sender, userDebtBalance.add(bonus));

    // Cast User addr to payable
    address payable user = address(uint160(_userAddr));

    // Transfer left-over collateral to user
    IERC20(vAssets.collateralAsset).uniTransfer(user, remainingCollat);

    emit evLiquidate(_userAddr, msg.sender, IVault(vault).getBorrowAsset(), userDebtBalance);
  }

  /**
  * @dev Initiates a flashloan used to repay partially or fully the debt position of msg.sender
  * @param _amount: Pass -1 to fully close debt position, otherwise Amount to be repaid with a flashloan
  *@param vault: The vault address where the debt position exist.
  */
  function flashClose(int256 _amount, address vault) external nonReentrant {

    // Update Balances at FujiERC1155
    IVault(vault).updateF1155Balances();

    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).getF1155());

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultext.VaultAssets memory vAssets = IVaultext(vault).vAssets();

    // Get user  Balances
    uint256 userCollateral = F1155.balanceOf(msg.sender, vAssets.collateralID);
    uint256 userDebtBalance = F1155.balanceOf(msg.sender, vAssets.borrowID);
    uint256 neededCollateral;

    // Check Debt is > zero
    require(userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);

    Flasher tflasher = Flasher(flasher);

    if(_amount < 0) {

      // Check there is enough Collateral for FlashClose
      neededCollateral = IVault(vault).getNeededCollateralFor(userDebtBalance, false);
      require(userCollateral >= neededCollateral, Errors.VL_UNDERCOLLATERIZED_ERROR);

      FlashLoan.Info memory info = FlashLoan.Info({
        callType: FlashLoan.CallType.Close,
        asset: vAssets.borrowAsset,
        amount: userDebtBalance,
        vault: vault,
        newProvider: address(0),
        user: msg.sender,
        userliquidator: address(0),
        fliquidator: address(this)
      });

      tflasher.initiateDyDxFlashLoan(info);

    } else {

      // Check _amount passed is greater than zero
      require(_amount>0, Errors.VL_AMOUNT_ERROR);

      // Check _amount passed is less than debt
      require(uint256(_amount) < userDebtBalance, Errors.VL_AMOUNT_ERROR);

      // Check there is enough Collateral for FlashClose
      neededCollateral = IVault(vault).getNeededCollateralFor(uint256(_amount), false);
      require(userCollateral >= neededCollateral, Errors.VL_UNDERCOLLATERIZED_ERROR);

      // Compute Split debt between BaseProtocol and FujiOptmizer Fee
      (,uint256 fujidebt) =
          F1155.splitBalanceOf(msg.sender, vAssets.borrowID);

      // Check FlashClose amount is greater than acccrued fujiOptimized Fee interest
      require(uint256(_amount) > fujidebt, Errors.VL_MINIMUM_PAYBACK_ERROR);

      FlashLoan.Info memory info = FlashLoan.Info({
        callType: FlashLoan.CallType.Close,
        asset: vAssets.borrowAsset,
        amount: uint256(_amount),
        vault: vault,
        newProvider: address(0),
        user: msg.sender,
        userliquidator: address(0),
        fliquidator: address(this)
      });

      tflasher.initiateDyDxFlashLoan(info);

    }
  }

  /**
  * @dev Initiates a flashloan to liquidate an undercollaterized debt position,
  * gets bonus (bonusFlashL in Vault)
  * @param _userAddr: Address of user whose position is liquidatable
  */
  function flashLiquidate(address _userAddr, address vault) external nonReentrant {

    // Update Balances at FujiERC1155
    IVault(vault).updateF1155Balances();

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultext.VaultAssets memory vAssets = IVaultext(vault).vAssets();

    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).getF1155());

    // Get user Collateral and Debt Balances
    uint256 userCollateral = F1155.balanceOf(_userAddr, vAssets.collateralID);
    uint256 userDebtBalance = F1155.balanceOf(_userAddr, vAssets.borrowID);

    // Compute Amount of Minimum Collateral Required including factors
    uint256 neededCollateral = IVault(vault).getNeededCollateralFor(userDebtBalance, true);

    // Check if User is liquidatable
    require(
      userCollateral < neededCollateral,
      Errors.VL_USER_NOT_LIQUIDATABLE
    );

    Flasher tflasher = Flasher(flasher);

    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.Liquidate,
      asset: vAssets.borrowAsset,
      amount: userDebtBalance,
      vault: vault,
      newProvider: address(0),
      user: _userAddr,
      userliquidator: msg.sender,
      fliquidator: address(this)
    });

    tflasher.initiateDyDxFlashLoan(info);
  }

  /**
  * @dev Close user's debt position by using a flashloan
  * @param _userAddr: user addr to be liquidated
  * @param _Amount: amount received by Flashloan
  * @param vault: Vault address
  * Emits a {FlashClose} event.
  */
  function executeFlashClose(address payable _userAddr, uint256 _Amount, address vault) external onlyFlash nonReentrant {

    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).getF1155());

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultext.VaultAssets memory vAssets = IVaultext(vault).vAssets();

    // Get user Collateral and Debt Balances
    uint256 userCollateral = F1155.balanceOf(_userAddr, vAssets.collateralID);
    uint256 userDebtBalance = F1155.balanceOf(_userAddr, vAssets.borrowID);

    // Get user Collateral + Flash Close Fee to close posisition, for _Amount passed
    uint256 userCollateralinPlay = (IVault(vault).getNeededCollateralFor(_Amount, false)).mul(flashCloseF.a).div(flashCloseF.b);

    // Load the FlashLoan funds to this contract.
    IERC20(vAssets.borrowAsset).transferFrom(flasher, address(this), _Amount);

    // Compute Split debt between BaseProtocol and FujiOptmizer Fee
    (,uint256 fujidebt) =
        F1155.splitBalanceOf(_userAddr, vAssets.borrowID);

    // Approve Amount to Vault
    IERC20(vAssets.borrowAsset).approve(vault, _Amount.sub(fujidebt));

    // Repay BaseProtocol debt
    IVault(vault).payback(int256(_Amount.sub(fujidebt)));

    // Transfer Fuji Split Debt to Fuji Treasury
    IERC20(vAssets.borrowAsset).uniTransfer(ftreasury, fujidebt);

    // Logic to handle Full or Partial FlashClose
    bool isFullFlashClose = _Amount == userDebtBalance ? true: false;

    if (isFullFlashClose) {

      // Burn Collateral F1155 tokens
      F1155.burn(_userAddr, vAssets.collateralID, userCollateral);

      // Withdraw Full collateral
      IVault(vault).withdraw(int256(userCollateral));

      // Send unUsed Collateral to User
      uint256 userCollateraluntouched = userCollateral.sub(userCollateralinPlay);
      _userAddr.transfer(userCollateraluntouched);

    } else {

      // Burn Collateral F1155 tokens
      F1155.burn(_userAddr, vAssets.collateralID, userCollateralinPlay);

      // Withdraw Collateral in play Only
      IVault(vault).withdraw(int256(userCollateralinPlay));

    }

    // Swap Collateral for underlying to repay Flashloan
    uint256 remainingFujiCollat = swap(vault, _Amount, userCollateralinPlay);

    // Send FlashClose Fee to FujiTreasury
    IERC20(vAssets.collateralAsset).uniTransfer(ftreasury, remainingFujiCollat);

    // Send flasher the underlying to repay Flashloan
    IERC20(vAssets.borrowAsset).uniTransfer(payable(flasher), _Amount);

    emit FlashClose(_userAddr, vAssets.borrowAsset, userDebtBalance);
  }

  /**
  * @dev Liquidate a debt position by using a flashloan
  * @param _userAddr: user addr to be liquidated
  * @param _liquidatorAddr: liquidator address
  * @param _Amount: amount of debt to be repaid
  * @param vault: Vault address
  * Emits a {FlashLiquidate} event.
  */
  function executeFlashLiquidation(address _userAddr,address _liquidatorAddr,uint256 _Amount, address vault) external  onlyFlash nonReentrant {

    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).getF1155());

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultext.VaultAssets memory vAssets = IVaultext(vault).vAssets();

    // Get user Collateral and Debt Balances
    uint256 userCollateral = F1155.balanceOf(_userAddr, vAssets.collateralID);
    uint256 userDebtBalance = F1155.balanceOf(_userAddr, vAssets.borrowID);

    // Load the FlashLoan funds to this contract.
    IERC20(vAssets.borrowAsset).transferFrom(flasher, address(this), _Amount);

    // Compute Split debt between BaseProtocol and FujiOptmizer Fee
    (uint256 protocolDebt,uint256 fujidebt) =
        F1155.splitBalanceOf(_userAddr, vAssets.borrowID);

    // Approve Amount to Vault
    IERC20(vAssets.borrowAsset).approve(vault, protocolDebt);

    // Repay BaseProtocol debt
    IVault(vault).payback(int256(protocolDebt));

    // Transfer Fuji Split Debt to Fuji Treasury
    IERC20(vAssets.borrowAsset).uniTransfer(ftreasury, fujidebt);

    // Burn Collateral F1155 tokens
    F1155.burn(_userAddr, vAssets.collateralID, userCollateral);

    // Withdraw collateral
    IVault(vault).withdraw(int256(userCollateral));

    // Compute the Liquidator Bonus bonusFlashL
    uint256 bonus = IVault(vault).getLiquidationBonusFor(userDebtBalance, true);

    uint256 remainingCollat = swap(vault, _Amount.add(bonus), userCollateral);

    // Cast Addresses to payable
    address payable liquidator = address(uint160(_liquidatorAddr));
    address payable user = address(uint160(_userAddr));

    // Transfer Bonus bonusFlashL to liquidator
    IERC20(vAssets.borrowAsset).uniTransfer(liquidator, bonus);

    // transfer Remaining Collateral to user deducted by bonus
    IERC20(vAssets.collateralAsset).uniTransfer(user, remainingCollat.sub(bonus));

    // Burn Debt F1155 tokens
    F1155.burn(_userAddr, vAssets.borrowID, userDebtBalance);

    emit FlashLiquidate(_userAddr, _liquidatorAddr,vAssets.borrowAsset, userDebtBalance);
  }


  function swap(address _vault, uint256 _amountToReceive, uint256 _collateralAmount) internal returns(uint256) {

    // Swap Collateral Asset to Borrow Asset
    address[] memory path = new address[](2);
    path[0] = swapper.WETH();
    path[1] = IVault(_vault).getBorrowAsset();
    uint[] memory swapperAmounts = swapper.swapETHForExactTokens{ value: _collateralAmount }(
      _amountToReceive,
      path,
      address(this),
      block.timestamp
    );

    return swapperAmounts[0];

  }

  // Administrative functions

  /**
  * @dev Changes the Controller contract address
  * @param _newController: address of new flasher contract
  */
  function setController(address _newController) external isAuthorized {
    controller = _newController;
  }

  /**
  * @dev Sets the flasher for this contract.
  * @param _newflasher: flasher address
  */
  function setFlasher(address _newflasher) external isAuthorized {
    flasher = _newflasher;
  }

  /**
  * @dev Changes the Swapper contract address
  * @param _newSwapper: address of new swapper contract
  */
  function setSwapper(address _newSwapper) external isAuthorized {
    swapper = IUniswapV2Router02(_newSwapper);
  }

  /**
  * @dev Sets the Treasury address
  * @param _newTreasury: new Fuji Treasury address
  */
  function setTreasury(address payable _newTreasury) external isAuthorized {
    ftreasury = _newTreasury;
  }

  /**
  * @dev Sets the Flash Close Fee Factor; should  be < 1
  * E. g. 1% fee: a = 1, b = 100, Fee = 1/100 = 1%
  * @param _newFactorA: Small number
  * @param _newFactorB: Big number (typically 100)
  */
  function setbonusL(uint64 _newFactorA, uint64 _newFactorB) external isAuthorized {
    flashCloseF.a = _newFactorA;
    flashCloseF.b = _newFactorB;
  }

}
