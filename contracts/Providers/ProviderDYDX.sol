// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25 <0.7.5;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { UniERC20 } from "./LibUniERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IProvider } from "./IProvider.sol";

import "hardhat/console.sol"; //test line

interface wethIERC20 is IERC20 {
  function deposit() external payable;
  function withdraw(uint) external;
}

interface SoloMarginContract {

  struct Info {
    address owner;
    uint256 number;
  }

  struct Price {
      uint256 value;
  }

  struct Value {
      uint256 value;
  }

  enum ActionType {
    Deposit,
    Withdraw,
    Transfer,
    Buy,
    Sell,
    Trade,
    Liquidate,
    Vaporize,
    Call
  }

  enum AssetDenomination {
    Wei,
    Par
  }

  enum AssetReference {
    Delta,
    Target
  }

  struct AssetAmount {
    bool sign;
    AssetDenomination denomination;
    AssetReference ref;
    uint256 value;
  }

  struct ActionArgs {
    ActionType actionType;
    uint256 accountId;
    AssetAmount amount;
    uint256 primaryMarketId;
    uint256 secondaryMarketId;
    address otherAddress;
    uint256 otherAccountId;
    bytes data;
  }

struct Wei {
    bool sign;
    uint256 value;
}

  function operate(Info[] calldata accounts, ActionArgs[] calldata actions) external;

  function getAccountWei(Info calldata account, uint256 marketId) external view returns (Wei memory);

  function getNumMarkets() external view returns (uint256);

  function getMarketTokenAddress(uint256 marketId) external view returns (address);

  function getAccountValues(Info memory account) external view returns (Value memory, Value memory);

  }

contract HelperFunct {

  /**
  * @dev get Dydx Solo Address
  */
  function getDydxAddress() public pure returns (address addr) {
    addr = 0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e;
}

  /**
   * @dev get WETH address
  */
  function getWETHAddr() public pure returns (address weth) {
      weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  }

  /**
  * @dev Return ethereum address
  */
  function getEthAddr() internal pure returns (address) {
    return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE; // ETH Address
  }

  /**
    * @dev Get Dydx Market ID from token Address
  */
  function getMarketId(SoloMarginContract solo, address token) internal view returns (uint _marketId) {
      uint markets = solo.getNumMarkets();
      address _token = token == getEthAddr() ? getWETHAddr() : token;
      bool check = false;
      for (uint i = 0; i < markets; i++) {
          if (_token == solo.getMarketTokenAddress(i)) {
              _marketId = i;
              check = true;
              break;
          }
      }
      require(check, "DYDX Market doesn't exist!");
  }

  /**
  * @dev Get Dydx Acccount arg
  */
  function getAccountArgs() internal view returns (SoloMarginContract.Info[] memory) {
    SoloMarginContract.Info[] memory accounts = new SoloMarginContract.Info[](1);
    console.log(address(this));
    accounts[0] = (SoloMarginContract.Info(address(this), 0));
    return accounts;
  }

  /**
  * @dev Get Dydx Actions args.
  */
  function getActionsArgs(uint256 marketId, uint256 amt, bool sign) internal view returns (SoloMarginContract.ActionArgs[] memory) {
    SoloMarginContract.ActionArgs[] memory actions = new SoloMarginContract.ActionArgs[](1);
    SoloMarginContract.AssetAmount memory amount = SoloMarginContract.AssetAmount(
        sign,
        SoloMarginContract.AssetDenomination.Wei,
        SoloMarginContract.AssetReference.Delta,
        amt
    );
    bytes memory empty;
    SoloMarginContract.ActionType action = sign ? SoloMarginContract.ActionType.Deposit : SoloMarginContract.ActionType.Withdraw;
    actions[0] = SoloMarginContract.ActionArgs(
        action,
        0,
        amount,
        marketId,
        0,
        address(this),
        0,
        empty
    );
    return actions;
  }

  /**
  * @dev Get Dydx Position
  */
  function getDydxPosition(SoloMarginContract solo, uint256 marketId) internal view returns (uint256 tokenBal, bool tokenSign) {
    SoloMarginContract.Wei memory tokenWeiBal = solo.getAccountWei(getAccountArgs()[0], marketId);
    tokenBal = tokenWeiBal.value;
    tokenSign = tokenWeiBal.sign;
  }


}

contract ProviderDYDX is IProvider, HelperFunct {

  using SafeMath for uint256;
  using UniERC20 for IERC20;

  bool public donothing = true;

  //Provider Core Functions

  /**
 * @dev Deposit ETH/ERC20_Token.
 * @param _depositAsset: token address to deposit. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
 * @param _amount: token amount to deposit.
 */
 function deposit(address _depositAsset, uint256 _amount) external override payable{

    SoloMarginContract dydxContract = SoloMarginContract(getDydxAddress());

    uint _marketId = getMarketId(dydxContract, _depositAsset);

    if (_depositAsset == getEthAddr()) {

        wethIERC20 tweth = wethIERC20(getWETHAddr());
        tweth.deposit{value: _amount}();
        tweth.approve(getDydxAddress(), _amount);

    } else {

        wethIERC20 tweth = wethIERC20(_depositAsset);
        tweth.approve(getDydxAddress(), _amount);
    }

    dydxContract.operate(getAccountArgs(), getActionsArgs(_marketId, _amount, true));

    (uint tokenBal, bool tokenSign) = getDydxPosition(dydxContract,_marketId); //test line
    console.log('Deposit, DYDX','marketID', _marketId);//test line
    console.log('TokenBal', tokenBal,'TokenSign', tokenSign);//test line

  }

  /**
 * @dev Withdraw ETH/ERC20_Token.
 * @param _withdrawAsset: token address to withdraw. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
 * @param _amount: token amount to withdraw.
 */
  function withdraw(address _withdrawAsset, uint256 _amount) external override payable {

    SoloMarginContract dydxContract = SoloMarginContract(getDydxAddress());

    uint _marketId = getMarketId(dydxContract, _withdrawAsset);

    dydxContract.operate(getAccountArgs(), getActionsArgs(_marketId, _amount, false));

    if (_withdrawAsset == getEthAddr()) {

        wethIERC20 tweth = wethIERC20(getWETHAddr());

        tweth.approve(address(tweth), _amount);

        tweth.withdraw(_amount);
    }

    (uint tokenBal, bool tokenSign) = getDydxPosition(dydxContract,_marketId); //test line
    console.log('Withdraw, DYDX','marketID', _marketId);//test line
    console.log('TokenBal', tokenBal,'TokenSign', tokenSign);//test line

  }

  /**
 * @dev Borrow ETH/ERC20_Token.
 * @param _borrowAsset token address to borrow.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
 * @param _amount: token amount to borrow.
 */
  function borrow(address _borrowAsset, uint256 _amount) external override payable {

    SoloMarginContract dydxContract = SoloMarginContract(getDydxAddress());

    uint _marketId = getMarketId(dydxContract, _borrowAsset);

    dydxContract.operate(getAccountArgs(), getActionsArgs(_marketId, _amount, false));

    if (_borrowAsset == getEthAddr()) {

      wethIERC20 tweth = wethIERC20(getWETHAddr());

      tweth.approve(address(_borrowAsset), _amount);

      tweth.withdraw(_amount);
      }

      (uint tokenBal, bool tokenSign) = getDydxPosition(dydxContract,_marketId); //test line
      console.log('Borrow, DYDX','marketID', _marketId);//test line
      console.log('TokenBal', tokenBal,'TokenSign', tokenSign);//test line
  }

  /**
  * @dev Payback borrowed ETH/ERC20_Token.
  * @param _paybackAsset token address to payback.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
  * @param _amount: token amount to payback.
  */
  function payback(address _paybackAsset, uint256 _amount) external override payable {

    SoloMarginContract dydxContract = SoloMarginContract(getDydxAddress());

    uint _marketId = getMarketId(dydxContract, _paybackAsset);

    if (_paybackAsset == getEthAddr()) {

        wethIERC20 tweth = wethIERC20(getWETHAddr());
        tweth.deposit{value: _amount}();
        tweth.approve(getDydxAddress(), _amount);

    } else {

        wethIERC20 tweth = wethIERC20(_paybackAsset);
        tweth.approve(getDydxAddress(), _amount);
    }

    dydxContract.operate(getAccountArgs(), getActionsArgs(_marketId, _amount, true));

    (uint tokenBal, bool tokenSign) = getDydxPosition(dydxContract,_marketId); //test line
    console.log('Payback, DYDX','marketID', _marketId);//test line
    console.log('TokenBal', tokenBal,'TokenSign', tokenSign);//test line

  }


  /**
  * @dev Returns the current borrowing rate (APR) of a ETH/ERC20_Token, in ray(1e27).
  * @param _asset: token address to query the current borrowing rate.
  */
  function getBorrowRateFor(address _asset) external view override returns(uint256) {
    return 0;
  }

  /**
  * @dev Returns the borrow balance of a ETH/ERC20_Token.
  * @param _asset: token address to query the balance.
  */
  function getBorrowBalance(address _asset) external view override returns(uint256) {
    SoloMarginContract dydxContract = SoloMarginContract(getDydxAddress());
    uint _marketId = getMarketId(dydxContract, _asset);
    (uint256 tokenBal, bool tokenSign) = getDydxPosition(dydxContract,_marketId);
    return tokenBal;
  }

  /**
  * @dev Returns the borrow balance of a ETH/ERC20_Token.
  * @param _asset: token address to query the balance.
  */
  function getDepositBalance(address _asset) external view override returns(uint256) {
    SoloMarginContract dydxContract = SoloMarginContract(getDydxAddress());
    uint _marketId = getMarketId(dydxContract, _asset);
    SoloMarginContract.Info memory account = SoloMarginContract.Info({
      owner: msg.sender,
      number: 0
    });
    SoloMarginContract.Wei memory structbalance = dydxContract.getAccountWei(account,_marketId);
    uint256 balance = structbalance.value;
    return balance;
  }

}
