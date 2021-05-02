// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import { IVault} from "./Vaults/IVault.sol";
import { IFujiAdmin } from "./IFujiAdmin.sol";
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

import "hardhat/console.sol"; //test line

interface IVaultExt is IVault {

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

  struct Factor {
    uint64 a;
    uint64 b;
  }

  // Flash Close Fee Factor
  Factor public flashCloseF;

  IFujiAdmin private fujiAdmin;
  IUniswapV2Router02 public swapper;

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
      msg.sender == fujiAdmin.getFlasher(),
      Errors.VL_NOT_AUTHORIZED);
    _;
  }

  constructor() public {

    // 1.013
    flashCloseF.a = 1013;
    flashCloseF.b = 1000;

  }

  receive() external payable {}

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
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(vault).vAssets();

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

    // TODO: Get => corresponding amount of BaseProtocol Debt and FujiDebt

    // Transfer Amount to Vault
    IERC20(vAssets.borrowAsset).transfer(vault, userDebtBalance);

    // TODO: Get => corresponding amount of BaseProtocol Debt and FujiDebt

    // Repay BaseProtocol debt
    IVault(vault).payback(int256(userDebtBalance));

    //TODO: Transfer corresponding Debt Amount to Fuji Treasury

    // Burn Debt F1155 tokens
    F1155.burn(_userAddr, vAssets.borrowID, userDebtBalance);

    // Burn Collateral F1155 tokens
    F1155.burn(_userAddr, vAssets.collateralID, userCollateral);

    // Withdraw collateral
    IVault(vault).withdraw(int256(userCollateral));

    // Compute the Liquidator Bonus bonusL
    uint256 bonus = IVault(vault).getLiquidationBonusFor(userDebtBalance, false);

    // Swap Collateral
    uint256 remainingCollat = swap(vault, userDebtBalance.add(bonus), userCollateral);

    // Transfer to Liquidator the debtBalance + bonus
    IERC20(vAssets.borrowAsset).uniTransfer(msg.sender, userDebtBalance.add(bonus));

    // Transfer left-over collateral to user
    IERC20(vAssets.collateralAsset).uniTransfer(payable(_userAddr), remainingCollat);

    emit evLiquidate(_userAddr, msg.sender, vAssets.borrowAsset, userDebtBalance);
  }

  /**
  * @dev Initiates a flashloan used to repay partially or fully the debt position of msg.sender
  * @param _amount: Pass -1 to fully close debt position, otherwise Amount to be repaid with a flashloan
  * @param vault: The vault address where the debt position exist.
  * @param _flashnum: integer identifier of flashloan provider
  */
  function flashClose(int256 _amount, address vault, uint8 _flashnum) external nonReentrant {

    // Update Balances at FujiERC1155
    IVault(vault).updateF1155Balances();

    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(vault).vAssets();

    // Get user  Balances
    uint256 userCollateral = F1155.balanceOf(msg.sender, vAssets.collateralID);
    uint256 userDebtBalance = F1155.balanceOf(msg.sender, vAssets.borrowID);
    uint256 neededCollateral;

    // Check Debt is > zero
    require(userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);

    Flasher tflasher = Flasher(payable(fujiAdmin.getFlasher()));

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

      tflasher.initiateFlashloan(info, _flashnum);

    } else {

      // Check _amount passed is greater than zero
      require(_amount>0, Errors.VL_AMOUNT_ERROR);

      // Check _amount passed is less than debt
      require(uint256(_amount) < userDebtBalance, Errors.VL_AMOUNT_ERROR);

      // Check there is enough Collateral for FlashClose
      neededCollateral = IVault(vault).getNeededCollateralFor(uint256(_amount), false);
      require(userCollateral >= neededCollateral, Errors.VL_UNDERCOLLATERIZED_ERROR);

      // TODO: Get => corresponding amount of BaseProtocol Debt and FujiDebt

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

      tflasher.initiateFlashloan(info, _flashnum);

    }
  }

  /**
  * @dev Initiates a flashloan to liquidate an undercollaterized debt position,
  * gets bonus (bonusFlashL in Vault)
  * @param _userAddr: Address of user whose position is liquidatable
  * @param vault: The vault address where the debt position exist.
  * @param _flashnum: integer identifier of flashloan provider
  */
  function flashLiquidate(address _userAddr, address vault, uint8 _flashnum) external nonReentrant {

    // Update Balances at FujiERC1155
    IVault(vault).updateF1155Balances();

    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(vault).vAssets();

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

    Flasher tflasher = Flasher(payable(fujiAdmin.getFlasher()));

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

    tflasher.initiateFlashloan(info, _flashnum);
  }

  /**
  * @dev Close user's debt position by using a flashloan
  * @param _userAddr: user addr to be liquidated
  * @param vault: Vault address
  * @param _Amount: amount received by Flashloan
  * @param flashloanfee: amount extra charged by flashloan provider
  * Emits a {FlashClose} event.
  */
  function executeFlashClose(
    address payable _userAddr,
    address vault,
    uint256 _Amount,
    uint256 flashloanfee
  ) external onlyFlash {
    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(vault).vAssets();

    // Get user Collateral and Debt Balances
    uint256 userCollateral = F1155.balanceOf(_userAddr, vAssets.collateralID);
    uint256 userDebtBalance = F1155.balanceOf(_userAddr, vAssets.borrowID);

    // Get user Collateral + Flash Close Fee to close posisition, for _Amount passed
    uint256 userCollateralinPlay =
    (IVault(vault).getNeededCollateralFor(_Amount.add(flashloanfee), false))
    .mul(flashCloseF.a).div(flashCloseF.b);

    // TODO: Get => corresponding amount of BaseProtocol Debt and FujiDebt

    // Repay BaseProtocol debt
    IVault(vault).payback(int256(_Amount));

    //TODO: Transfer corresponding Debt Amount to Fuji Treasury

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
    uint256 remainingFujiCollat = swap(vault, _Amount.add(flashloanfee), userCollateralinPlay);

    // Send FlashClose Fee to FujiTreasury
    IERC20(vAssets.collateralAsset).uniTransfer(fujiAdmin.getTreasury(), remainingFujiCollat);

    // Send flasher the underlying to repay Flashloan
    IERC20(vAssets.borrowAsset).uniTransfer(payable(fujiAdmin.getFlasher()), _Amount.add(flashloanfee));

    // Burn Debt F1155 tokens
    F1155.burn(_userAddr, vAssets.borrowID, _Amount);

    emit FlashClose(_userAddr, vAssets.borrowAsset, userDebtBalance);
  }

  /**
  * @dev Liquidate a debt position by using a flashloan
  * @param _userAddr: user addr to be liquidated
  * @param _liquidatorAddr: liquidator address
  * @param vault: Vault address
  * @param _Amount: amount of debt to be repaid
  * @param flashloanfee: amount extra charged by flashloan provider
  * Emits a {FlashLiquidate} event.
  */
  function executeFlashLiquidation(
    address _userAddr,
    address _liquidatorAddr,
    address vault,
    uint256 _Amount,
    uint256 flashloanfee
  ) external  onlyFlash {

    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).fujiERC1155());

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(vault).vAssets();

    // Get user Collateral and Debt Balances
    uint256 userCollateral = F1155.balanceOf(_userAddr, vAssets.collateralID);
    uint256 userDebtBalance = F1155.balanceOf(_userAddr, vAssets.borrowID);

    // Burn Collateral F1155 tokens
    F1155.burn(_userAddr, vAssets.collateralID, userCollateral);

    // TODO: Get => corresponding amount of BaseProtocol Debt and FujiDebt

    //TODO: Transfer corresponding Debt Amount to Fuji Treasury

    // Repay BaseProtocol debt to release collateral
    IVault(vault).payback(int256(_Amount));

    // Withdraw collateral
    IVault(vault).withdraw(int256(userCollateral));

    // Compute the Liquidator Bonus bonusFlashL
    uint256 bonus = IVault(vault).getLiquidationBonusFor(userDebtBalance, true);

    uint256 remainingCollat = swap(
      vault,
      _Amount.add(flashloanfee).add(bonus),
      userCollateral
    );

    // Send flasher the underlying to repay Flashloan
    IERC20(vAssets.borrowAsset).uniTransfer(payable(fujiAdmin.getFlasher()), _Amount.add(flashloanfee));

    // Transfer Bonus bonusFlashL to liquidator
    IERC20(vAssets.borrowAsset).uniTransfer(payable(_liquidatorAddr), bonus);

    // Transfer left-over collateral to user
    IERC20(vAssets.collateralAsset).uniTransfer(payable(_userAddr), remainingCollat);

    // Burn Debt F1155 tokens
    F1155.burn(_userAddr, vAssets.borrowID, userDebtBalance);

    emit FlashLiquidate(_userAddr, _liquidatorAddr, vAssets.borrowAsset, userDebtBalance);
  }

  /**
  * @dev Swap an amount of underlying
  * @param _vault: Vault address
  * @param _amountToReceive: amount of underlying to Receive
  * @param _collateralAmount: collateral Amount sent for swap
  */
  function swap(address _vault, uint256 _amountToReceive, uint256 _collateralAmount) internal returns(uint256) {

    // Struct Instance to get Vault Asset IDs in F1155
    IVaultExt.VaultAssets memory vAssets = IVaultExt(_vault).vAssets();

    // Swap Collateral Asset to Borrow Asset
    address[] memory path = new address[](2);
    path[0] = swapper.WETH();
    path[1] = vAssets.borrowAsset;
    uint[] memory swapperAmounts = swapper.swapETHForExactTokens{ value: _collateralAmount }(
      _amountToReceive,
      path,
      address(this),
      block.timestamp
    );

    return _collateralAmount.sub(swapperAmounts[0]);
  }

  // Administrative functions

  /**
  * @dev Set Factors "a" and "b" for a Struct Factor flashcloseF
  * For flashCloseF;  should be > 1, a/b
  * @param _newFactorA: A number
  * @param _newFactorB: A number
  */
  function setFlashCloseFee(uint64 _newFactorA, uint64 _newFactorB) external isAuthorized {
    flashCloseF.a = _newFactorA;
    flashCloseF.b = _newFactorB;
  }

  /**
  * @dev Sets the fujiAdmin Address
  * @param _fujiAdmin: FujiAdmin Contract Address
  */
  function setfujiAdmin(address _fujiAdmin) public isAuthorized{
    fujiAdmin = IFujiAdmin(_fujiAdmin);
  }

  /**
  * @dev Changes the Swapper contract address
  * @param _newSwapper: address of new swapper contract
  */
  function setSwapper(address _newSwapper) external isAuthorized {
    swapper = IUniswapV2Router02(_newSwapper);
  }


}
