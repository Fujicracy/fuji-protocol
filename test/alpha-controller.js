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
    /*

    it("1.- Check Rates for All Vaults", async () => {

      // Set defined ActiveProviders
      await vaultdai.setActiveProvider(dydx.address);
      await vaultusdc.setActiveProvider(dydx.address);
      await vaultusdt.setActiveProvider(aave.address);

      // Responses
      let responsedai = await controller.checkRates(vaultdai.address);
      let responseusdc = await controller.checkRates(vaultusdc.address);
      let responseusdt = await controller.checkRates(vaultusdc.address);
      //console.log(responsedai,responseusdc,responseusdt);

      // Manual Rate check

      let getInfo = async function (provider, assetaddr) {
        let info = [];
        info[0] = await provider.getBorrowRateFor(assetaddr);
        info[0] = info[0]/1e27;
        info[1] = provider.address;
        return info;
      }

      //DAI
      let dairatedydx = await getInfo(dydx, DAI_ADDR);
      let dairateaave = await getInfo(aave, DAI_ADDR);
      let dairatecompound = await getInfo(compound, DAI_ADDR);
      //console.log("dai markets",dairatedydx,dairateaave,dairatecompound);

      let daiLowestRate;
      daiLowestRate = dairatedydx[0] < dairateaave[0] ? dairatedydx:dairateaave;
      daiLowestRate =  dairatecompound[0] < daiLowestRate[0] ? dairatecompound:daiLowestRate;
      await expect(responsedai[1]).to.equal(daiLowestRate[1]);

      //USDC
      let usdcratedydx = await getInfo(dydx, USDC_ADDR);
      let usdcrateaave = await getInfo(aave, USDC_ADDR);
      let usdcratecompound = await getInfo(compound, USDC_ADDR);
      //console.log("usdc markets",usdcratedydx,usdcrateaave,usdcratecompound);

      let usdcLowestRate;
      usdcLowestRate = usdcratedydx[0] < usdcrateaave[0] ? usdcratedydx:usdcrateaave;
      usdcLowestRate = usdcratecompound[0] < usdcLowestRate[0] ? usdcratecompound : usdcLowestRate;
      await expect(responseusdc[1]).to.equal(usdcLowestRate[1]);

      //USDT
      let usdtrateaave = await getInfo(aave, USDT_ADDR);
      let usdtratecompound = await getInfo(compound, USDT_ADDR);
      //console.log("usdt markets",usdtrateaave,usdtratecompound);

      let usdtLowestRate;
      usdtLowestRate = usdtrateaave[0] < usdtratecompound[0] ? usdtrateaave : usdtratecompound;
      await expect(responseusdt[1]).to.equal(usdtLowestRate[1]);

      //console.log(daiLowestRate,usdcLowestRate,usdtLowestRate);
      //console.log("compound", compound.address);
      //console.log("aave", aave.address);
      //console.log("dydx", dydx.address);
    });
    */

    it("2.- Try ForcedRefinancing VaultDai", async () => {

      // Console log providers
      console.log("Aave", aave.address);
      console.log("Compound", compound.address);
      console.log("Dydx", dydx.address);

      // Testing Vault
      let thevault = vaultdai;
      let asset = dai;
      let pre_stagedProvider = aave;
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
      await controller.connect(users[0]).forcedRefinancing(thevault.address, destinationProvider.address, 1, 4, true, false);

      let afterRefinanceVaultDebt = await thevault.borrowBalance(destinationProvider.address);
      let afterRefinanceVaultCollat = await thevault.depositBalance(destinationProvider.address);
      console.log(afterRefinanceVaultDebt/1, afterRefinanceVaultCollat/1);

      //await expect(priorRefinanceVaultDebt/1).to.be.closeTo(afterRefinanceVaultDebt/1,1000e9);
      //await expect(priorRefinanceVaultCollat/1).to.be.closeTo(afterRefinanceVaultCollat/1,1000e9);

    });

  });
});
