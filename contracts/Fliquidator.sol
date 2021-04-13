// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import { IVault} from "./Vaults/IVault.sol";
import { VaultBaseFunctions } from "./Vaults/VaultBase.sol";
import { IFujiERC1155} from "./FujiERC1155/IFujiERC1155.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { Flasher } from "./flashloans/Flasher.sol";
import { FlashLoan } from "./flashloans/LibFlashLoan.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Errors} from "./Libraries/Errors.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { UniERC20 } from "./LibUniERC20.sol";
import { IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

interface IController {
  function getvaults() external view returns(address[] memory);
}

contract Fliquidator is VaultBaseFunctions, Ownable {

  using SafeMath for uint256;
  using UniERC20 for IERC20;

  receive() external payable {}

  IUniswapV2Router02 public swapper;
  address public controller;
  address public flasher;

  // Log Liquidation
  event evLiquidate(address userAddr, address liquidator, uint256 amount);
  // Log FlashClose
  event FlashClose(address userAddr, uint256 amount);
  // Log Liquidation
  event FlashLiquidate(address userAddr, address liquidator, uint256 amount);

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

  constructor(address _swapper) public {
    swapper = IUniswapV2Router02(_swapper);
  }

  // FLiquidator Core Functions

  /**
  * @dev Liquidate an undercollaterized debt and get 5% bonus
  * @param _userAddr: Address of user whose position is liquidatable
  * @param _vault: Address of the vault in where liquidation will occur
  */
  function liquidate(address _userAddr, address vault) external {

    // Update Balances at FujiERC1155
    IVault(vault).updateF1155Balances();

    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).getF1155());

    // Get user Collateral and Debt Balances
    uint256 userCollateral = F1155.balanceOf(_userAddr, IVault(vault).getCollateralAsset());
    uint256 userDebtBalance = F1155.balanceOf(_userAddr, IVault(vault).getBorrowAsset());

    // Compute Amount of Minimum Collateral Required
    uint256 neededCollateral = IVault(vault).getNeededCollateralFor(userDebtBalance, false);

    // Check if User is liquidatable
    require(
      userCollateral < neededCollateral,
      Errors.VL_USER_NOT_LIQUIDATABLE
    );

    // Check Liquidator Allowance
    require(
      IERC20(IVault(vault).getBorrowAsset()).allowance(msg.sender, vault) >= userDebtBalance,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );

    // Get Split amount of Base Protocol Debt Only
    (,uint256 fujidebt) = IFujiERC1155(FujiERC1155).splitBalanceOf(msg.sender,vAssets.borrowID);

    // Transfer borrowAsset Owed to Base protocol from Liquidator to Vault
    IERC20(IVault(vault).getBorrowAsset()).transferFrom(msg.sender, address(this), userDebtBalance);

    // repay debt
    _payback(userDebtBalance.sub(fujidebt),IVault(vault).activeProvider());

    // withdraw collateral
    IVault(vault).withdraw(userCollateral);

    // get 5% of user debt
    uint256 bonus = IVault(vault).getLiquidationBonusFor(userDebtBalance, false);

    // Reduce collateralBalance
    uint256 newcollateralBalance = 0; //(IVault(vault).getcollateralBalance()).sub(userCollateral); fix
    //IVault(vault).setVaultCollateralBalance(newcollateralBalance); fix
    // update user collateral
    //IVault(vault).setUsercollateral(_userAddr, 0); fix

    // transfer 5% of debt position to liquidator
    IERC20(IVault(vault).getCollateralAsset()).uniTransfer(msg.sender, bonus);
    // cast user addr to payable
    address payable user = address(uint160(_userAddr));
    // transfer left collateral to user
    uint256 leftover = userCollateral.sub(bonus);
    IERC20(IVault(vault).getCollateralAsset()).uniTransfer(user, leftover);

    // burn debt
    IDebtToken(debtToken).burn(_userAddr,userDebtBalance);

    emit evLiquidate(_userAddr, msg.sender, userDebtBalance);
  }

  /**
  * @dev Initiates a flashloan used to repay partially or fully the debt position of msg.sender
  * @param _amount: Pass -1 to fully close debt position, otherwise Amount to be repaid with a flashloan
  *@param vault: The vault address where the debt position exist.
  */
  function flashClose(int256 _amount, address vault) external {

    // Update Balances at FujiERC1155
    IVault(vault).updateF1155Balances();

    // Create Instance of FujiERC1155
    IFujiERC1155 F1155 = IFujiERC1155(IVault(vault).getF1155());

    // Get user Debt Balances, and check debt is non-zero
    uint256 userDebtBalance = F1155.balanceOf(_userAddr, IVault(vault).getBorrowAsset());
    require(userDebtBalance > 0, Errors.VL_NO_DEBT_TO_PAYBACK);

    Flasher tflasher = Flasher(flasher);

    if(_amount < 0) {

      FlashLoan.Info memory info = FlashLoan.Info({
        callType: FlashLoan.CallType.Close,
        asset: IVault(vault).getBorrowAsset(),
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

      FlashLoan.Info memory info = FlashLoan.Info({
        callType: FlashLoan.CallType.Close,
        asset: IVault(vault).getBorrowAsset(),
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
  * gets 4% bonus
  * @param _userAddr: Address of user whose position is liquidatable
  */
  function flashLiquidate(address _userAddr, address vault) external {

    //IVault(vault).updateDebtTokenBalances();
    address debtToken = address(0);//IVault(vault).debtToken(); fix

    uint256 userCollateral = 0; //IVault(vault).getUsercollateral(_userAddr); fix
    uint256 userDebtBalance = 0; //IDebtToken(debtToken).balanceOf(_userAddr); fix

    // do checks user is liquidatable
    uint256 neededCollateral = IVault(vault).getNeededCollateralFor(userDebtBalance);
    require(
      userCollateral >= neededCollateral,
      Errors.VL_USER_NOT_LIQUIDATABLE
    );

    FlashLoan.Info memory info = FlashLoan.Info({
      callType: FlashLoan.CallType.Liquidate,
      asset: IVault(vault).getBorrowAsset(),
      amount: userDebtBalance,
      vault: vault,
      newProvider: address(0),
      user: _userAddr,
      userliquidator: msg.sender,
      fliquidator: address(this)
    });

    Flasher tflasher = Flasher(IVault(vault).getFlasher());
    tflasher.initiateDyDxFlashLoan(info);
  }

  /**
  * @dev Close user's debt position by using a flashloan
  * @param _userAddr: user addr to be liquidated
  * @param _debtAmount: amount of debt to be repaid
  * Emits a {FlashClose} event.
  */
  function executeFlashClose(address _userAddr, uint256 _debtAmount, address vault) external {

    address debtToken = address(0);//IVault(vault).debtToken(); fix

    // TODO make callable only from Flasher
    uint256 userCollateral = IVault(vault).getUsercollateral(_userAddr);
    uint256 userDebtBalance = IDebtToken(debtToken).balanceOf(_userAddr);

    // reduce collateralBalance
    uint256 newcollateralBalance = 0; //(IVault(vault).getcollateralBalance()).sub(userCollateral); fix
    //IVault(vault).setVaultCollateralBalance(newcollateralBalance); fix
    // update user collateral
    //IVault(vault).setUsercollateral(_userAddr, 0); fix

    uint leftover = _repayAndSwap(userDebtBalance, userCollateral, _debtAmount, vault);

    // cast user addr to payable
    address payable user = address(uint160(_userAddr));
    // transfer left ETH amount to user
    IERC20(IVault(vault).getCollateralAsset()).uniTransfer(user, userCollateral.sub(leftover));

    // burn debt
    //IDebtToken(debtToken).burn(_userAddr,userDebtBalance); fix

    emit FlashClose(_userAddr, userDebtBalance);
  }

  /**
  * @dev Liquidate a debt position by using a flashloan
  * @param _userAddr: user addr to be liquidated
  * @param _liquidatorAddr: liquidator address
  * @param _debtAmount: amount of debt to be repaid
  * Emits a {FlashLiquidate} event.
  */
  function executeFlashLiquidation(address _userAddr,address _liquidatorAddr,uint256 _debtAmount, address vault) external {

    address debtToken = address(0);//IVault(vault).debtToken(); fix

    // TODO make callable only from Flasher
    uint256 userCollateral = IVault(vault).getUsercollateral(_userAddr);
    uint256 userDebtBalance = 0; //IDebtToken(debtToken).balanceOf(_userAddr); fix

    // reduce collateralBalance
    uint256 newcollateralBalance = 0; //(IVault(vault).getcollateralBalance()).sub(userCollateral); fix
    //IVault(vault).setVaultCollateralBalance(newcollateralBalance); fix
    // update user collateral
    //IVault(vault).setUsercollateral(_userAddr, 0); fix

    uint256 leftover = _repayAndSwap(userDebtBalance, userCollateral, _debtAmount, vault);

    // get 4% of user debt
    uint256 bonus = IVault(vault).getLiquidationBonusFor(_debtAmount, true);
    // cast user addr to payable
    address payable liquidator = address(uint160(_liquidatorAddr));
    // transfer 4% of debt position to liquidator
    IERC20(IVault(vault).getCollateralAsset()).uniTransfer(liquidator, bonus);
    // cast user addr to payable
    address payable user = address(uint160(_userAddr));
    // transfer left collateral to user deducted by bonus
    IERC20(IVault(vault).getCollateralAsset()).uniTransfer(user, leftover.sub(bonus));

    // burn debt
    //IDebtToken(debtToken).burn(_userAddr,userDebtBalance); fix

    emit FlashLiquidate(_userAddr, _liquidatorAddr, userDebtBalance);
  }

  /**
  * @dev Gets borrowAsset from flasher, repays a debt position,
  * withdraws collateral, swaps it on Uniswap and repays flashloan
  * @param _borrowAmount: Borrow amount of the position
  * @param _collateralAmount: Collateral amount of the position
  * @param _debtAmount: Amount of borrowAsset to be repaid to flasher
  * @return leftover amount of collateral after swap
  */
  function _repayAndSwap(
    uint256 _borrowAmount,
    uint256 _collateralAmount,
    uint256 _debtAmount,
    address vault
  ) internal returns(uint) {

    require(
      IERC20(IVault(vault).getBorrowAsset()).allowance(IVault(vault).getFlasher(), address(this)) >= _borrowAmount,
      Errors.VL_MISSING_ERC20_ALLOWANCE
    );
    IERC20(IVault(vault).getBorrowAsset()).transferFrom(IVault(vault).getFlasher(), address(this), _borrowAmount);

    // 1. payback current provider
    IVault(vault).payback(_borrowAmount);

    // 2. withdraw collateral from current provider
    IVault(vault).withdraw(_collateralAmount);

    // swap withdrawn ETH for DAI on uniswap
    address[] memory path = new address[](2);
    path[0] = uniswap.WETH();
    path[1] = IVault(vault).getBorrowAsset();
    uint[] memory uniswapAmounts = uniswap.swapETHForExactTokens{ value: _collateralAmount }(
      _debtAmount,
      path,
      address(this),
      block.timestamp
    );

    // return borrowed amount to Flasher
    IERC20(IVault(vault).getBorrowAsset()).uniTransfer(payable(IVault(vault).getFlasher()), _debtAmount);

    return uniswapAmounts[0];
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

}
