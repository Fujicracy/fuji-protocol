// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "hardhat/console.sol"; //test line

interface IComptroller {
  function claimComp(address holder) external;
}

interface IAaveLiquidityMining {
  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to
  ) external returns (uint256);

  function getUserUnclaimedRewards(address _user) external view returns (uint256);

  function getRewardsBalance(address[] calldata assets, address user)
    external
    view
    returns (uint256);
}

contract VaultHarvester {
  address[] private _aaveClaimAddrs;
  IAaveLiquidityMining private _aaVeLM =
    IAaveLiquidityMining(0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5);
  IComptroller private _comppTLR = IComptroller(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);

  constructor() {
    _aaveClaimAddrs.push(address(0x030bA81f1c18d280636F32af80b9AAd02Cf0854e)); //aWETH
    _aaveClaimAddrs.push(address(0xF63B34710400CAd3e044cFfDcAb00a0f32E33eCf)); //variableDebtWETH
    _aaveClaimAddrs.push(address(0x6C3c78838c761c6Ac7bE9F59fe808ea2A6E4379d)); //variableDebtDAI
    _aaveClaimAddrs.push(address(0x619beb58998eD2278e08620f97007e1116D5D25b)); //variableDebtUSDC
    _aaveClaimAddrs.push(address(0x531842cEbbdD378f8ee36D171d6cC9C4fcf475Ec)); //variableDebtUSDT
    _aaveClaimAddrs.push(address(0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656)); //awBTC
    _aaveClaimAddrs.push(address(0x9c39809Dec7F95F5e0713634a4D0701329B3b4d2)); //variableDebtwBTC
  }

  /**
   * @dev Called by the Vault to harvest farmed tokens at baselayer Protocols
   * @param _farmProtocolNum: Number assigned to Protocol for farming
   */
  function collectRewards(uint256 _farmProtocolNum) external returns (address claimedToken) {
    if (_farmProtocolNum == 0) {
      _comppTLR.claimComp(msg.sender);
      claimedToken = 0xc00e94Cb662C3520282E6f5717214004A7f26888;
    } else if (_farmProtocolNum == 1) {
      //uint256 rewards = _aaVeLM.getRewardsBalance(_aaveClaimAddrs, msg.sender);
      //uint256 unclaimedrewards = _aaVeLM.getUserUnclaimedRewards(msg.sender);
      //uint256 number = _aaVeLM.claimRewards(_aaveClaimAddrs, unclaimedrewards, msg.sender);
      claimedToken = 0x4da27a545c0c5B758a6BA100e3a049001de870f5;
    } else {
      claimedToken = 0x0000000000000000000000000000000000000000;
    }
  }

  /* TroubleShooting
  IAaveLiquidityMining private aaVeLM = IAaveLiquidityMining(0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5);

  function collectRewards() external returns(address claimedToken) {
    uint256 rewards = aaVeLM.getRewardsBalance(aaveClaimAddrs, msg.sender);
    uint256 unclaimedrewards = aaVeLM.getUserUnclaimedRewards(msg.sender);
    console.log("rewards",rewards);  //rewards 1707698532938001
    console.log("unclaimedrewards", unclaimedrewards); //unclaimedrewards 1385394489051127
    uint256 number = aaVeLM.claimRewards(aaveClaimAddrs, unclaimedrewards, msg.sender);
    console.log("claimed number", number); //claimed number 0
    claimedToken = 0x4da27a545c0c5B758a6BA100e3a049001de870f5;
    }
  */
}
