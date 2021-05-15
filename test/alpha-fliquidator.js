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
    it("1.- Normal Liquidation User, vaultDai", async () => {

      // vault to use
      let thevault = vaultdai;
      let asset = dai;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(compound.address);

      // Set - up
      let carelessUser = users[5];
      let liquidatorUser = users[15];
      let borrowAmount = ethers.utils.parseUnits("5000", 18);
      let depositAmount = await thevault.getNeededCollateralFor(borrowAmount, true);
      let smallExtra = ethers.utils.parseEther("0.01");
      let vAssetStruct = await thevault.vAssets();

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      let extraChange = ethers.utils.parseUnits("1", 18);
      await thevault.connect(bootstraper)
        .depositAndBorrow(bstrapLiquidity, extraChange, { value: bstrapLiquidity });
      // Part of set-up > Sending Liquidator some extra change to pay for interest
      await asset.connect(bootstraper).transfer(liquidatorUser.address, extraChange);

      // Set up the debt position of carelessUser
      depositAmount = depositAmount.add(smallExtra);
      await thevault.connect(carelessUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      // Staged condition to make user liquidatable
      // Careless user spends Dai (transferred to Liquidator for test purpose)
      await asset.connect(carelessUser).transfer(liquidatorUser.address, borrowAmount);
      // For purposes of testing only way to make user liquidatable is by changing factors
      await thevault.connect(users[0]).setFactor(3, 2, false);

      let liqBalAtStart = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalAtStart", liqBalAtStart.toString());

      await asset.connect(liquidatorUser)
        .approve(fliquidator.address, borrowAmount.add(extraChange));
      await fliquidator.connect(liquidatorUser)
        .liquidate(carelessUser.address, thevault.address);

      let liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalAtEnd", liqBalAtEnd.toString());

      let carelessUser1155bal0 = await f1155.balanceOf(carelessUser.address, vAssetStruct.collateralID);
      let carelessUser1155bal1 = await f1155.balanceOf(carelessUser.address, vAssetStruct.borrowID);
      //console.log("1155tokenbal0", carelessUser1155bal0/1, "1155tokenbal1", carelessUser1155bal1/1);

      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);
      await expect(carelessUser1155bal0).to.be.gt(0);
      await expect(carelessUser1155bal1).to.be.eq(0);
    });

    it("2.- Normal Liquidation User, vaultusdc", async () => {

      // vault to use
      let thevault = vaultusdc;
      let asset = usdc;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(dydx.address);

      // Set - up
      let carelessUser = users[5];
      let liquidatorUser = users[15];
      let borrowAmount = ethers.utils.parseUnits("5000", 6);
      let depositAmount = await thevault.getNeededCollateralFor(borrowAmount, true);
      let vAssetStruct = await thevault.vAssets();

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      let extraChange = ethers.utils.parseUnits("0.01", 6);
      await thevault.connect(bootstraper)
        .depositAndBorrow(bstrapLiquidity, extraChange, { value: bstrapLiquidity });
      // Part of set-up > Sending Liquidator some extra change to pay for interest
      await asset.connect(bootstraper).transfer(liquidatorUser.address,extraChange);

      // Set up the debt position of carelessUser
      depositAmount = depositAmount.add(10);
      await thevault.connect(carelessUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      // Staged condition to make user liquidatable
      // Careless user spends Dai (transferred to Liquidator for test purpose)
      await asset.connect(carelessUser).transfer(liquidatorUser.address,borrowAmount);
      // For purposes of testing only way to make user liquidatable is by changing factors
      await thevault.connect(users[0]).setFactor(3, 2, false);

      let liqBalAtStart = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalAtStart", liqBalAtStart.toString());

      await asset.connect(liquidatorUser)
        .approve(fliquidator.address, borrowAmount.add(extraChange));
      await fliquidator.connect(liquidatorUser)
        .liquidate(carelessUser.address, thevault.address);

      let liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalAtEnd", liqBalAtEnd.toString());

      let carelessUser1155bal0 = await f1155.balanceOf(carelessUser.address, vAssetStruct.collateralID);
      let carelessUser1155bal1 = await f1155.balanceOf(carelessUser.address, vAssetStruct.borrowID);
      //console.log("1155tokenbal0", carelessUser1155bal0/1, "1155tokenbal1", carelessUser1155bal1/1);

      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);
      await expect(carelessUser1155bal0).to.be.gt(0);
      await expect(carelessUser1155bal1).to.be.eq(0);

    });

    it("3.- Full Flashclose User, vaultDai with cream FL", async () => {

      // vault to use
      let thevault = vaultdai;
      let asset = dai;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(dydx.address);

      // Set - up
      let randomUser = users[6];
      let borrowAmount = ethers.utils.parseUnits("3000", 18);
      let depositAmount = ethers.utils.parseEther("5", 18);
      let vAssetStruct = await thevault.vAssets();

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await thevault.connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      await fliquidator.connect(randomUser).flashClose(-1, thevault.address, 2);

      let randomUser1155balCollat = await f1155.balanceOf(randomUser.address, vAssetStruct.collateralID);
      let randomUser1155balDebt = await f1155.balanceOf(randomUser.address, vAssetStruct.borrowID);
      //console.log("1155tokenbalcollat", randomUser1155balCollat/1, "1155tokenbaldebt", randomUser1155balDebt/1);

      await expect(randomUser1155balCollat).to.equal(0);
      await expect(randomUser1155balDebt).to.equal(0);
    });

    it("4.- Full Flashclose User, vaultUsdc with dYdX FL", async () => {

      // vault to use
      let thevault = vaultusdc;
      let asset = usdc;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(aave.address);

      // Set - up
      let randomUser = users[7];
      let borrowAmount = ethers.utils.parseUnits("3000", 6);
      let depositAmount = ethers.utils.parseEther("5", 18);
      let vAssetStruct = await thevault.vAssets();

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await thevault.connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      await fliquidator.connect(randomUser).flashClose(-1, thevault.address, 1);

      let randomUser1155balCollat = await f1155.balanceOf(randomUser.address, vAssetStruct.collateralID);
      let randomUser1155balDebt = await f1155.balanceOf(randomUser.address, vAssetStruct.borrowID);
      //console.log("1155tokenbalcollat", randomUser1155balCollat/1, "1155tokenbaldebt", randomUser1155balDebt/1);

      await expect(randomUser1155balCollat).to.equal(0);
      await expect(randomUser1155balDebt).to.equal(0);

    });

    it("5.- Partial Flashclose User, vaultUsdt with aave FL", async () => {

      // vault to use
      let thevault = vaultusdt;
      let asset = usdt;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(aave.address);

      // Set - up
      let randomUser = users[8];
      let depositAmount = ethers.utils.parseEther("10", 18);
      let borrowAmount = ethers.utils.parseUnits("7500", 6);
      let partialRepayAmount = ethers.utils.parseUnits("5000", 6);
      let vAssetStruct = await thevault.vAssets();

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await thevault.connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      let randomUser1155balCollat0 = await f1155.balanceOf(randomUser.address, vAssetStruct.collateralID);
      let randomUser1155balDebt0 = await f1155.balanceOf(randomUser.address, vAssetStruct.borrowID);
      //console.log("1155tokenbalcollat0", randomUser1155balCollat0/1, "1155tokenbaldebt0", randomUser1155balDebt0/1);

      await fliquidator.connect(randomUser).flashClose(partialRepayAmount, thevault.address, 0);

      let randomUser1155balCollat1 = await f1155.balanceOf(randomUser.address, vAssetStruct.collateralID);
      let randomUser1155balDebt1 = await f1155.balanceOf(randomUser.address, vAssetStruct.borrowID);
      //console.log("1155tokenbalcollat1", randomUser1155balCollat1/1, "1155tokenbaldebt1", randomUser1155balDebt1/1);

      await expect(randomUser1155balCollat1).to.be.lt(randomUser1155balCollat0);
      await expect(randomUser1155balDebt1).to.be.lt(randomUser1155balDebt0);
    });

    it("6.- Partial Flashclose User, vaultUsdc with dYdX", async () => {

      // vault to use
      let thevault = vaultusdc;
      let asset = usdc;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(aave.address);

      // Set - up
      let randomUser = users[10];
      let depositAmount = ethers.utils.parseEther("10", 18);
      let borrowAmount = ethers.utils.parseUnits("7500", 6);
      let partialRepayAmount = ethers.utils.parseUnits("5000", 6);
      let vAssetStruct = await thevault.vAssets();

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await thevault.connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      let randomUser1155balCollat0 = await f1155.balanceOf(randomUser.address, vAssetStruct.collateralID);
      let randomUser1155balDebt0 = await f1155.balanceOf(randomUser.address, vAssetStruct.borrowID);
      //console.log("1155tokenbalcollat0", randomUser1155balCollat0/1, "1155tokenbaldebt0", randomUser1155balDebt0/1);

      await fliquidator.connect(randomUser).flashClose(partialRepayAmount, thevault.address, 1);

      let randomUser1155balCollat1 = await f1155.balanceOf(randomUser.address, vAssetStruct.collateralID);
      let randomUser1155balDebt1 = await f1155.balanceOf(randomUser.address, vAssetStruct.borrowID);
      //console.log("1155tokenbalcollat1", randomUser1155balCollat1/1, "1155tokenbaldebt1", randomUser1155balDebt1/1);

      await expect(randomUser1155balCollat1).to.be.lt(randomUser1155balCollat0);
      await expect(randomUser1155balDebt1).to.be.lt(randomUser1155balDebt0);
    });

    it("7.- FlashLiquidation a User, vaultDai", async () => {

      // vault to use
      let thevault = vaultdai;
      let asset = dai;
      let activeProvider = dydx;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(activeProvider.address);

      // Set - up
      let carelessUser = users[12];
      let liquidatorUser = users[15];
      let borrowAmount = ethers.utils.parseUnits("5000", 18);
      let depositAmount = await thevault.getNeededCollateralFor(borrowAmount, true);
      let smallExtra = ethers.utils.parseEther("0.01");
      let vAssetStruct = await thevault.vAssets();
      //console.log(depositAmount/1,borrowAmount/1);

      let liqBalatend0 = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalatend0",liqBalatend0/1);

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set up the debt position of carelessUser
      depositAmount = depositAmount.add(smallExtra);
      await thevault.connect(carelessUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      // Staged condition to make user liquidatable
      // Careless user spends Dai (transferred to Liquidator for test purpose)
      await asset.connect(carelessUser).transfer(bootstraper.address,borrowAmount);
      // For purposes of testing only way to make user liquidatable is by changing factors
      await thevault.connect(users[0]).setFactor(3, 2, false);

      let liqBalAtStart = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalAtStart", liqBalAtStart.toString());

      if ((activeProvider == aave || activeProvider == compound) && (asset == dai || asset == usdc) ) {
        await fliquidator.connect(liquidatorUser)
          .flashLiquidate(carelessUser.address, thevault.address, 1);
      } else {
        await fliquidator.connect(liquidatorUser)
          .flashLiquidate(carelessUser.address, thevault.address, 0);
      }

      let liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalAtEnd", liqBalAtEnd.toString());

      let carelessUser1155bal0 = await f1155.balanceOf(carelessUser.address, vAssetStruct.collateralID);
      let carelessUser1155bal1 = await f1155.balanceOf(carelessUser.address, vAssetStruct.borrowID);
      //console.log("1155tokenbal0", carelessUser1155bal0/1, "1155tokenbal1", carelessUser1155bal1/1);

      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);
      await expect(carelessUser1155bal0).to.be.gt(0);
      await expect(carelessUser1155bal1).to.be.eq(0);
    });

    it("8.- FlashLiquidation a User, vaultUsdc", async () => {

      // vault to use
      let thevault = vaultusdc;
      let asset = usdc;
      let activeProvider = dydx;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(activeProvider.address);

      // Set - up
      let carelessUser = users[13];
      let liquidatorUser = users[16];
      let borrowAmount = ethers.utils.parseUnits("5000", 6);
      let depositAmount = await thevault.getNeededCollateralFor(borrowAmount,true);
      let smallExtra = ethers.utils.parseEther("0.01");
      let vAssetStruct = await thevault.vAssets();
      //console.log(depositAmount/1,borrowAmount/1);

      let liqBalatend0 = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalatend0",liqBalatend0/1);

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set up the debt position of carelessUser
      depositAmount = depositAmount.add(smallExtra);
      await thevault.connect(carelessUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      // Staged condition to make user liquidatable
      // Careless user spends Dai (transferred to Liquidator for test purpose)
      await asset.connect(carelessUser).transfer(bootstraper.address, borrowAmount);
      // For purposes of testing only way to make user liquidatable is by changing factors
      await thevault.connect(users[0]).setFactor(3, 2, false);

      let liqBalAtStart = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalAtStart", liqBalAtStart.toString());

      if ((activeProvider == aave || activeProvider == compound) && (asset == dai || asset == usdc) ) {
        await fliquidator.connect(liquidatorUser)
          .flashLiquidate(carelessUser.address, thevault.address, 1);
      } else {
        await fliquidator.connect(liquidatorUser)
          .flashLiquidate(carelessUser.address, thevault.address, 0);
      }

      let liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      //console.log("liqBalAtEnd", liqBalAtEnd.toString());

      let carelessUser1155bal0 = await f1155.balanceOf(carelessUser.address, vAssetStruct.collateralID);
      let carelessUser1155bal1 = await f1155.balanceOf(carelessUser.address, vAssetStruct.borrowID);
      //console.log("1155tokenbal0", carelessUser1155bal0/1, "1155tokenbal1", carelessUser1155bal1/1);

      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);
      await expect(carelessUser1155bal0).to.be.gt(0);
      await expect(carelessUser1155bal1).to.be.eq(0);
    });

  });
});
