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

  describe("Alpha Fliquidator Functionality", () => {

    it("1.- NormalLiquidation a User, VaultDai", async () => {

      // vault to use
      let thevault = vaultdai;
      let asset = dai;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(dydx.address);

      // Set - up
      let carelessUser = users[5];
      let liquidatorUser = users[15];
      let borrowAmount = ethers.utils.parseUnits("5000",18);
      let depositAmount = await thevault.getNeededCollateralFor(borrowAmount,true);

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      let extraChange = ethers.utils.parseUnits("0.01",18);
      await thevault.connect(bootstraper).depositAndBorrow(bstrapLiquidity, extraChange, { value: bstrapLiquidity });
      // Part of set-up > Sending Liquidator some extra change to pay for interest
      await asset.connect(bootstraper).transfer(liquidatorUser.address,extraChange);


      // Set up the debt position of carelessUser
      depositAmount = depositAmount.add(10);
      await thevault.connect(carelessUser).depositAndBorrow(depositAmount,borrowAmount,{ value: depositAmount });

      // Staged condition to make user liquidatable
      // Careless user spends Dai (transferred to Liquidator for test purpose)
      await asset.connect(carelessUser).transfer(liquidatorUser.address,borrowAmount);
      // For purposes of testing only way to make user liquidatable is by changing factors
      await thevault.connect(users[0]).setFactor(3,2,false);

      await asset.connect(liquidatorUser).approve(fliquidator.address, borrowAmount.add(extraChange));
      await fliquidator.connect(liquidatorUser).liquidate(carelessUser.address, thevault.address);

      let liqBalatend = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalatend",liqBalatend/1);
      //let carelessUser1155bal0 = await f1155.balanceOf(carelessUser.address,0);
      //let carelessUser1155bal1 = await f1155.balanceOf(carelessUser.address,1);
      //console.log("1155tokenbal0",carelessUser1155bal0/1,"1155tokenbal1",carelessUser1155bal1/1);

      await expect(liqBalatend).to.be.gt(borrowAmount);

    });

    it("2.- NormalLiquidation a User, vaultusdc", async () => {

      // vault to use
      let thevault = vaultusdc;
      let asset = usdc;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(dydx.address);

      // Set - up
      let carelessUser = users[5];
      let liquidatorUser = users[15];
      let borrowAmount = ethers.utils.parseUnits("5000",6);
      let depositAmount = await thevault.getNeededCollateralFor(borrowAmount,true);

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      let extraChange = ethers.utils.parseUnits("0.01",6);
      await thevault.connect(bootstraper).depositAndBorrow(bstrapLiquidity, extraChange, { value: bstrapLiquidity });
      // Part of set-up > Sending Liquidator some extra change to pay for interest
      await asset.connect(bootstraper).transfer(liquidatorUser.address,extraChange);

      // Set up the debt position of carelessUser
      depositAmount = depositAmount.add(10);
      await thevault.connect(carelessUser).depositAndBorrow(depositAmount,borrowAmount,{ value: depositAmount });

      // Staged condition to make user liquidatable
      // Careless user spends Dai (transferred to Liquidator for test purpose)
      await asset.connect(carelessUser).transfer(liquidatorUser.address,borrowAmount);
      // For purposes of testing only way to make user liquidatable is by changing factors
      await thevault.connect(users[0]).setFactor(3,2,false);

      await asset.connect(liquidatorUser).approve(fliquidator.address, borrowAmount.add(extraChange));
      await fliquidator.connect(liquidatorUser).liquidate(carelessUser.address, thevault.address);

      let liqBalatend = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalatend",liqBalatend/1);
      //let carelessUser1155bal0 = await f1155.balanceOf(carelessUser.address,0);
      //let carelessUser1155bal1 = await f1155.balanceOf(carelessUser.address,1);
      //console.log("1155tokenbal0",carelessUser1155bal0/1,"1155tokenbal1",carelessUser1155bal1/1);

      await expect(liqBalatend).to.be.gt(borrowAmount);

    });


  });
});
