// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.5;

interface IProvider {
  function deposit (  /*to be used as collateral*/
    bool _isETH, /*ETH deposits require a msg.value != 0 */
    address payable _DepositcTokenAddress, /*Compound cToken Address*/
    address _erc20TokenAddress, /* erc20 Token Address, used for ERC20 deposits only*/
    uint256 _tokenAmountToDeposit /*in token decimals, used for ERC20 deposits only*/
  ) external payable returns(bool);

  function withdraw ( /*remove collateral*/
    bool _isETH,
    bool redeemtype,   /*Indicate the function if amount is denominated in cTokens=true, or underlying token/ETH =false*/
    uint256 amounttoWithdraw, /*in token decimals*/
    address payable _WithdrawcTokenAddress, /*Compound cToken Address*/
    address _erc20TokenAddress /* erc20 Token Address, leave blank if not needed*/
  ) external payable returns (bool);

  function borrow (
    bool _isETH,
    address payable _BorrowcTokenAddress, /*Compound cToken Address*/
    address _erc20TokenAddress, /* erc20 Token Address, leave blank if borrowing eth not needed*/
    uint256 amounttoBorrow, /*in token decimals*/
    address _comptrollerAddress /*Compound Protocol Comptroller for netork*/
  ) external payable returns (bool);

  function repay(
    bool _isETH, /*ETH repay require a msg.value != 0 */
    address payable _BorrowcTokenAddress, /*Compound cToken Address*/
    address _erc20TokenAddress, /* erc20 Token Address, leave blank if borrowing eth not needed*/
    uint256 amounttoRepay, /*in token decimals for erc20, and ether=1, for ETH*/
    address _comptrollerAddress /*Compound Protocol Comptroller for netork*/
  ) external returns(bool)


}
