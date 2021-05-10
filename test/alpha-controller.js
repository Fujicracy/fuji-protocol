const { ethers } = require("hardhat");
const { expect } = require("chai");
const { solidity, createFixtureLoader } = require("ethereum-waffle");

const {
  fixture,
  convertToCurrencyDecimals,
  advanceblocks,
  convertToWei,
  evmSnapshot,
  evmRevert,
  DAI_ADDR,
  USDC_ADDR,
  USDT_ADDR,
  ONE_ETH
} = require("./utils-alpha.js");

//use(solidity);

describe("Alpha", () => {

  let dai;
  let usdc;
  let usdt;
  let aweth;
  let ceth;
  let oracle;
  let treasury;
  let fujiadmin;
  let fliquidator;
  let flasher;
  let controller;
  let f1155;
  let aave;
  let compound;
  let dydx;
  let aWhitelist;
  let vaultdai;
  let vaultusdc;
  let vaultusdt;

  let users;

  let loadFixture;
  let evmSnapshotId;

  before(async() => {
    users = await ethers.getSigners();
    loadFixture = createFixtureLoader(users, ethers.provider);
    evmSnapshotId = await evmSnapshot();

  });

  after(async() => {
    evmRevert(evmSnapshotId);

  });

  beforeEach(async() => {

    const _fixture = await loadFixture(fixture);
    dai = _fixture.dai;
    usdc = _fixture.usdc;
    usdt = _fixture.usdt;
    aweth = _fixture.aweth;
    ceth = _fixture.ceth;
    oracle = _fixture.oracle;
    treasury = _fixture.treasury;
    fujiadmin = _fixture.fujiadmin;
    fliquidator = _fixture.fliquidator;
    flasher = _fixture.flasher;
    controller = _fixture.controller;
    f1155 = _fixture.f1155;
    aave = _fixture.aave;
    compound = _fixture.compound;
    dydx = _fixture.dydx;
    aWhitelist = _fixture.aWhitelist;
    vaultdai = _fixture.vaultdai;
    vaultusdc = _fixture.vaultusdc;
    vaultusdt = _fixture.vaultusdt;

  });

  describe("Alpha Controller Functionality", () => {

    it("1.- Try ForcedRefinancing VaultDai", async () => {

      // Console log providers
      console.log("Aave", aave.address);
      console.log("Compound", compound.address);
      console.log("Dydx", dydx.address);

      // Testing Vault
      let thevault = vaultdai;
      let asset = dai;
      let pre_stagedProvider = dydx;
      let destinationProvider = compound;

      // Set defined ActiveProviders
      await thevault.setActiveProvider(pre_stagedProvider.address);
      console.log("pre_stagedProvider",pre_stagedProvider.address);

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      // Users deposit and borrow
      let userX = users[2]; let depositX = ethers.utils.parseEther("10"); let borrowX = ethers.utils.parseUnits("3000",18);
      let userY = users[3]; let depositY = ethers.utils.parseEther("5"); let borrowY = ethers.utils.parseUnits("2500",18);
      let userW = users[4]; let depositW = ethers.utils.parseEther("5"); let borrowW = ethers.utils.parseUnits("2300",18);

      await thevault.connect(userX).depositAndBorrow(depositX,borrowX,{ value: depositX });
      await thevault.connect(userY).depositAndBorrow(depositY,borrowY,{ value: depositY });
      await thevault.connect(userW).depositAndBorrow(depositW,borrowW,{ value: depositW });

      let priorRefinanceVaultDebt = await thevault.borrowBalance(pre_stagedProvider.address);
      let priorRefinanceVaultCollat = await thevault.depositBalance(pre_stagedProvider.address);
      console.log(priorRefinanceVaultDebt/1,priorRefinanceVaultCollat/1);

      //await advanceblocks(50);
      await controller.connect(users[0]).doRefinancing(thevault.address, destinationProvider.address, 1, 1, 0, false);

      let afterRefinanceVaultDebt = await thevault.borrowBalance(destinationProvider.address);
      let afterRefinanceVaultCollat = await thevault.depositBalance(destinationProvider.address);

      // Visual Check
      console.log(afterRefinanceVaultDebt/1, afterRefinanceVaultCollat/1);

      if(pre_stagedProvider == dydx || destinationProvider == dydx){
        priorRefinanceVaultDebt = priorRefinanceVaultDebt*1.0009;
        await expect(priorRefinanceVaultDebt/1).to.be.closeTo(afterRefinanceVaultDebt/1,1e15);
      } else {
        await expect(priorRefinanceVaultDebt/1).to.be.closeTo(afterRefinanceVaultDebt/1,1e15);
      }
      await expect(priorRefinanceVaultCollat/1).to.be.closeTo(afterRefinanceVaultCollat/1,1e15);

    });

  });
});
