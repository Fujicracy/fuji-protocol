// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12 <0.8.0;

interface IFujiAdmin {

  function getFlasher() external returns(address);
  function getFliquidator() external returns(address);
  function getController() external returns(address);
  function getTreasury() external returns(address payable);
  function getaWhitelist() external returns(address);

  function getBonusFlashL() external view returns(uint64, uint64);
  function getBonusLiq() external view returns(uint64, uint64);

}
