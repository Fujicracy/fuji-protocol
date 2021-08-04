const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { fixture, evmSnapshot, evmRevert } = require("./utils-alpha");

// use(solidity);

describe("Alpha", () => {
  let dai;
  let usdc;
  let fliquidator;
  let f1155;
  let aave;
  let compound;
  let dydx;
  let vaultdai;
  let vaultusdc;
  let vaultusdt;

  let users;

  let loadFixture;
  let evmSnapshotId;

  before(async () => {
    users = await ethers.getSigners();
    loadFixture = createFixtureLoader(users, ethers.provider);
    evmSnapshotId = await evmSnapshot();
  });

  after(async () => {
    evmRevert(evmSnapshotId);
  });

  beforeEach(async () => {
    const theFixture = await loadFixture(fixture);
    dai = theFixture.dai;
    usdc = theFixture.usdc;
    fliquidator = theFixture.fliquidator;
    f1155 = theFixture.f1155;
    aave = theFixture.aave;
    compound = theFixture.compound;
    dydx = theFixture.dydx;
    vaultdai = theFixture.vaultdai;
    vaultusdc = theFixture.vaultusdc;
    vaultusdt = theFixture.vaultusdt;
  });

  describe("Alpha Fliquidator Functionality", () => {
    it("1.- Normal batchLiquidate 1 User, vaultDai", async () => {
      const theVault = vaultdai;
      const vAssetStruct = await theVault.vAssets();
      const asset = dai;
      const activeProvider = compound;

      const bootstraper = users[0];
      const carelessUser = users[5];
      const liquidatorUser = users[15];
      const smallExtra = ethers.utils.parseEther("0.01");

      await theVault.setActiveProvider(activeProvider.address);

      // 1. User Borrows 5000 dai
      const borrowAmount = ethers.utils.parseUnits("5000", 18);
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        smallExtra
      );

      await theVault
        .connect(carelessUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      // 2. Liquidator prepares dai for liquidation
      // - User sends borrowed dai to liquidator. Liquidator needs dai to execute liquidation.
      await asset.connect(carelessUser).transfer(liquidatorUser.address, borrowAmount);

      // - Bootstraper borrows and sends some extra dai to liquidator. Liquidator needs to pay for the interest
      const bstrapLiquidity = ethers.utils.parseEther("1");
      const extraChange = ethers.utils.parseUnits("1", 18);
      await theVault
        .connect(bootstraper)
        .depositAndBorrow(bstrapLiquidity, extraChange, { value: bstrapLiquidity });
      await asset.connect(bootstraper).transfer(liquidatorUser.address, extraChange);

      // 3. Make users position as liquidatable by changing factors
      await theVault.connect(users[0]).setFactor(3, 2, "collatF");

      // 4. Liquidation executes batchLiquidate

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);

      await asset
        .connect(liquidatorUser)
        .approve(fliquidator.address, borrowAmount.add(extraChange));
      await fliquidator
        .connect(liquidatorUser)
        .batchLiquidate([carelessUser.address], theVault.address);

      // - Check liquidator's balance
      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      await expect(liqBalAtEnd).to.be.gt(
        liqBalAtStart,
        "Liquidator should get some dai after liquidation"
      );

      // - Check user's borrow position
      const carelessUser1155bal0 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.collateralID
      );
      const carelessUser1155bal1 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.borrowID
      );
      await expect(carelessUser1155bal0).to.be.gt(0, "User's borrow position should be removed");
      await expect(carelessUser1155bal1).to.be.eq(0, "User's borrow position should be removed");
    });

    it("2a.- Normal batchLiquidate 3 Users, vaultUsdc", async () => {
      // vault to use
      const theVault = vaultusdc;
      const vAssetStruct = await theVault.vAssets();
      const asset = usdc;
      const activeProvider = dydx;

      const bootstraper = users[0];
      const carelessUsers = [users[5], users[6], users[7]];
      const liquidatorUser = users[15];
      const smallExtra = ethers.utils.parseUnits("0.01", 6);

      await theVault.setActiveProvider(activeProvider.address);

      // 1. Users Borrows 5000 usdc
      const borrowAmount = ethers.utils.parseUnits("5000", 6);
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        smallExtra
      );
      for (let i = 0; i < carelessUsers.length; i++) {
        await theVault
          .connect(carelessUsers[i])
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      }

      // 2. Liquidator prepares dai for liquidation
      // - User sends borrowed dai to liquidator. Liquidator needs dai to execute liquidation.
      for (let i = 0; i < carelessUsers.length; i++) {
        await asset.connect(carelessUsers[i]).transfer(liquidatorUser.address, borrowAmount);
      }

      // - Bootstraper borrows and sends some extra dai to liquidator. Liquidator needs to pay for the interest
      const bstrapLiquidity = ethers.utils.parseEther("1");
      const extraChange = ethers.utils.parseUnits("1", 6);
      await theVault
        .connect(bootstraper)
        .depositAndBorrow(bstrapLiquidity, extraChange, { value: bstrapLiquidity });
      await asset.connect(bootstraper).transfer(liquidatorUser.address, extraChange);

      // 3. Make users position as liquidatable by changing factors
      await theVault.connect(users[0]).setFactor(3, 2, "collatF");

      // 4. Liquidation executes batchLiquidate

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);

      await asset
        .connect(liquidatorUser)
        .approve(fliquidator.address, liqBalAtStart.add(extraChange));
      await fliquidator
        .connect(liquidatorUser)
        .batchLiquidate(
          [carelessUsers[0].address, carelessUsers[1].address, carelessUsers[2].address],
          theVault.address
        );

      // - Check liquidator's balance
      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      await expect(liqBalAtEnd).to.be.gt(
        liqBalAtStart,
        "Liquidator should get some usdc after liquidation"
      );

      // - Check user's borrow position
      for (let i = 0; i < carelessUsers.length; i++) {
        const carelessUser1155bal0 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.collateralID
        );
        const carelessUser1155bal1 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.borrowID
        );
        await expect(carelessUser1155bal0).to.be.gt(0, "User's borrow position should be removed");
        await expect(carelessUser1155bal1).to.be.eq(0, "User's borrow position should be removed");
      }
    });

    it("2b.- Normal batchLiquidate 3 Users + 1 non-liquidatable, vaultusdc", async () => {
      // vault to use
      const theVault = vaultusdc;
      const asset = usdc;
      const activeProvider = dydx;

      // Set a defined ActiveProviders
      await theVault.setActiveProvider(activeProvider.address);

      // Set - up
      const carelessUsers = [users[5], users[6], users[7]];
      const goodUser = users[11];
      const liquidatorUser = users[15];
      const borrowAmount = ethers.utils.parseUnits("5000", 6);
      let depositAmount = await theVault.getNeededCollateralFor(borrowAmount, true);
      const goodDepositAmount = ethers.utils.parseEther("20");
      const smallExtra = ethers.utils.parseUnits("0.01", 6);
      const vAssetStruct = await theVault.vAssets();

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      const extraChange = ethers.utils.parseUnits("1", 6);
      await theVault
        .connect(bootstraper)
        .depositAndBorrow(bstrapLiquidity, extraChange, { value: bstrapLiquidity });
      // Part of set-up > Sending Liquidator some extra change to pay for interest
      await asset.connect(bootstraper).transfer(liquidatorUser.address, extraChange);

      // Set up the debt position of carelessUsers
      depositAmount = depositAmount.add(smallExtra);
      for (let i = 0; i < carelessUsers.length; i++) {
        await theVault
          .connect(carelessUsers[i])
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      }
      // Set up Good user
      await theVault
        .connect(goodUser)
        .depositAndBorrow(goodDepositAmount, borrowAmount, { value: goodDepositAmount });

      // Staged condition to make user liquidatable
      // Careless user spends Dai (transferred to Liquidator for test purpose)
      for (let i = 0; i < carelessUsers.length; i++) {
        await asset.connect(carelessUsers[i]).transfer(liquidatorUser.address, borrowAmount);
      }
      // goodUser spends Money (sent to liquidator for test purpose)
      await asset.connect(goodUser).transfer(liquidatorUser.address, borrowAmount);

      // For purposes of testing only way to make user liquidatable is by changing factors
      await theVault.connect(users[0]).setFactor(3, 2, "collatF");

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);
      // console.log("liqBalAtStart", liqBalAtStart.toString());

      await asset
        .connect(liquidatorUser)
        .approve(fliquidator.address, liqBalAtStart.add(extraChange));
      await fliquidator
        .connect(liquidatorUser)
        .batchLiquidate(
          [
            carelessUsers[0].address,
            goodUser.address,
            carelessUsers[1].address,
            carelessUsers[2].address,
          ],
          theVault.address
        );

      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      // console.log("liqBalAtEnd", liqBalAtEnd.toString());

      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      let carelessUser1155bal0;
      let carelessUser1155bal1;

      for (let i = 0; i < carelessUsers.length; i++) {
        carelessUser1155bal0 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.collateralID
        );
        carelessUser1155bal1 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.borrowID
        );
        // console.log(`        carelessUsers[${i}]:`,"1155tokenbal0", carelessUser1155bal0/1, "1155tokenbal1", carelessUser1155bal1/1);

        await expect(carelessUser1155bal0).to.be.gt(0);
        await expect(carelessUser1155bal1).to.be.eq(0);
      }

      const goodUser1155bal1 = await f1155.balanceOf(goodUser.address, vAssetStruct.borrowID);

      await expect(goodUser1155bal1).to.be.gt(0);
    });

    it("3.- Full Flashclose User, vaultDai with cream FL", async () => {
      // vault to use
      const theVault = vaultdai;

      // Set a defined ActiveProviders
      await theVault.setActiveProvider(dydx.address);

      // Set - up
      const randomUser = users[6];
      const borrowAmount = ethers.utils.parseUnits("3000", 18);
      const depositAmount = ethers.utils.parseEther("5", 18);
      const vAssetStruct = await theVault.vAssets();

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await theVault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await theVault
        .connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      await fliquidator.connect(randomUser).flashClose(-1, theVault.address, 2);

      const randomUser1155balCollat = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat", randomUser1155balCollat/1, "1155tokenbaldebt", randomUser1155balDebt/1);

      await expect(randomUser1155balCollat).to.equal(0);
      await expect(randomUser1155balDebt).to.equal(0);
    });

    it("4.- Full Flashclose User, vaultUsdc with dYdX FL", async () => {
      // vault to use
      const theVault = vaultusdc;

      // Set a defined ActiveProviders
      await theVault.setActiveProvider(aave.address);

      // Set - up
      const randomUser = users[7];
      const borrowAmount = ethers.utils.parseUnits("3000", 6);
      const depositAmount = ethers.utils.parseEther("5", 18);
      const vAssetStruct = await theVault.vAssets();

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await theVault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await theVault
        .connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      await fliquidator.connect(randomUser).flashClose(-1, theVault.address, 1);

      const randomUser1155balCollat = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat", randomUser1155balCollat/1, "1155tokenbaldebt", randomUser1155balDebt/1);

      await expect(randomUser1155balCollat).to.equal(0);
      await expect(randomUser1155balDebt).to.equal(0);
    });

    it("5.- Partial Flashclose User, vaultUsdt with aave FL", async () => {
      // vault to use
      const theVault = vaultusdt;

      // Set a defined ActiveProviders
      await theVault.setActiveProvider(aave.address);

      // Set - up
      const randomUser = users[8];
      const depositAmount = ethers.utils.parseEther("10", 18);
      const borrowAmount = ethers.utils.parseUnits("7500", 6);
      const partialRepayAmount = ethers.utils.parseUnits("5000", 6);
      const vAssetStruct = await theVault.vAssets();

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await theVault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await theVault
        .connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      const randomUser1155balCollat0 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt0 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat0", randomUser1155balCollat0/1, "1155tokenbaldebt0", randomUser1155balDebt0/1);

      await fliquidator.connect(randomUser).flashClose(partialRepayAmount, theVault.address, 0);

      const randomUser1155balCollat1 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt1 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat1", randomUser1155balCollat1/1, "1155tokenbaldebt1", randomUser1155balDebt1/1);

      await expect(randomUser1155balCollat1).to.be.lt(randomUser1155balCollat0);
      await expect(randomUser1155balDebt1).to.be.lt(randomUser1155balDebt0);
    });

    it("6.- Partial Flashclose User, vaultUsdc with dYdX", async () => {
      // vault to use
      const theVault = vaultusdc;

      // Set a defined ActiveProviders
      await theVault.setActiveProvider(aave.address);

      // Set - up
      const randomUser = users[10];
      const depositAmount = ethers.utils.parseEther("10", 18);
      const borrowAmount = ethers.utils.parseUnits("7500", 6);
      const partialRepayAmount = ethers.utils.parseUnits("5000", 6);
      const vAssetStruct = await theVault.vAssets();

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await theVault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await theVault
        .connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      const randomUser1155balCollat0 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt0 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat0", randomUser1155balCollat0/1, "1155tokenbaldebt0", randomUser1155balDebt0/1);

      await fliquidator.connect(randomUser).flashClose(partialRepayAmount, theVault.address, 1);

      const randomUser1155balCollat1 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt1 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat1", randomUser1155balCollat1/1, "1155tokenbaldebt1", randomUser1155balDebt1/1);

      await expect(randomUser1155balCollat1).to.be.lt(randomUser1155balCollat0);
      await expect(randomUser1155balDebt1).to.be.lt(randomUser1155balDebt0);
    });

    it("7.- FlashBatchLiquidation of 1 User, vaultDai", async () => {
      // vault to use
      const theVault = vaultdai;
      const asset = dai;
      const activeProvider = dydx;

      // Set a defined ActiveProviders
      await theVault.setActiveProvider(activeProvider.address);

      // Set - up
      const carelessUser = users[12];
      const liquidatorUser = users[15];
      const borrowAmount = ethers.utils.parseUnits("5000", 18);
      let depositAmount = await theVault.getNeededCollateralFor(borrowAmount, true);
      const smallExtra = ethers.utils.parseEther("0.01");
      const vAssetStruct = await theVault.vAssets();
      // console.log(depositAmount/1,borrowAmount/1);

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await theVault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set up the debt position of carelessUser
      depositAmount = depositAmount.add(smallExtra);
      await theVault
        .connect(carelessUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      // Staged condition to make user liquidatable
      // Careless user spends Dai (transferred out of wallet for test purpose)
      await asset.connect(carelessUser).transfer(bootstraper.address, borrowAmount);
      // For purposes of testing only way to make user liquidatable is by changing factors
      await theVault.connect(users[0]).setFactor(3, 2, "collatF");

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);
      // console.log("liqBalAtStart", liqBalAtStart.toString());

      // Conditional to Select Flashloan Provider
      let flashLoanProvider;

      if (
        (activeProvider === aave || activeProvider === compound) &&
        (asset === dai || asset === usdc)
      ) {
        flashLoanProvider = 2;
      } else {
        flashLoanProvider = 0;
      }

      await fliquidator
        .connect(liquidatorUser)
        .flashBatchLiquidate([carelessUser.address], theVault.address, flashLoanProvider);

      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      // console.log("liqBalAtEnd", liqBalAtEnd.toString());

      const carelessUser1155bal0 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.collateralID
      );
      const carelessUser1155bal1 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbal0", carelessUser1155bal0/1, "1155tokenbal1", carelessUser1155bal1/1);

      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);
      await expect(carelessUser1155bal0).to.be.gt(0);
      await expect(carelessUser1155bal1).to.be.eq(0);
    });

    it("8a.- FlashBatchLiquidation 5 Users, vaultUsdc", async () => {
      // vault to use
      const theVault = vaultusdc;
      const asset = usdc;
      const activeProvider = compound;

      // Set a defined ActiveProviders
      await theVault.setActiveProvider(activeProvider.address);

      // Set - up
      const carelessUsers = [users[13], users[14], users[15], users[16], users[17]];
      const liquidatorUser = users[8];
      const borrowAmount = ethers.utils.parseUnits("5000", 6);
      let depositAmount = await theVault.getNeededCollateralFor(borrowAmount, true);
      const smallExtra = ethers.utils.parseUnits("0.01", 6);
      const vAssetStruct = await theVault.vAssets();
      // console.log(depositAmount/1,borrowAmount/1);

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await theVault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set up the debt position of carelessUser
      depositAmount = depositAmount.add(smallExtra);
      for (let i = 0; i < carelessUsers.length; i++) {
        await theVault
          .connect(carelessUsers[i])
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      }

      // Staged condition to make user liquidatable
      // Careless users spends Dai (transferred out of wallet for test purpose)
      for (let i = 0; i < carelessUsers.length; i++) {
        await asset.connect(carelessUsers[i]).transfer(bootstraper.address, borrowAmount);
      }

      // For purposes of testing only way to make user liquidatable is by changing factors
      await theVault.connect(users[0]).setFactor(3, 2, "collatF");

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);
      // console.log("liqBalAtStart", liqBalAtStart.toString());

      // Conditional to Select Flashloan Provider
      let flashLoanProvider;

      if (
        (activeProvider === aave || activeProvider === compound) &&
        (asset === dai || asset === usdc)
      ) {
        flashLoanProvider = 2;
      } else {
        flashLoanProvider = 0;
      }

      await fliquidator
        .connect(liquidatorUser)
        .flashBatchLiquidate(
          [
            carelessUsers[0].address,
            carelessUsers[1].address,
            carelessUsers[2].address,
            carelessUsers[3].address,
            carelessUsers[4].address,
          ],
          theVault.address,
          flashLoanProvider
        );

      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      // console.log("liqBalAtEnd", liqBalAtEnd.toString());

      let carelessUser1155bal0;
      let carelessUser1155bal1;

      for (let i = 0; i < carelessUsers.length; i++) {
        carelessUser1155bal0 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.collateralID
        );
        carelessUser1155bal1 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.borrowID
        );
        // console.log(`        carelessUsers[${i}]:`,"1155tokenbal0", carelessUser1155bal0/1, "1155tokenbal1", carelessUser1155bal1/1);

        await expect(carelessUser1155bal0).to.be.gt(0);
        await expect(carelessUser1155bal1).to.be.eq(0);
      }

      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      const vaultdebt = await activeProvider
        .connect(bootstraper)
        .getBorrowBalanceOf(vAssetStruct.borrowAsset, theVault.address);
      // console.log(vaultdebt.value);

      await expect(vaultdebt.value).to.equal(0);
    });

    it("8b.- FlashBatchLiquidation 5 Users, +1 nonliquidatable vaultUsdc", async () => {
      // vault to use
      const theVault = vaultusdc;
      const asset = usdc;
      const activeProvider = compound;

      // Set a defined ActiveProviders
      await theVault.setActiveProvider(activeProvider.address);

      // Set - up
      const carelessUsers = [users[13], users[14], users[15], users[16], users[17]];
      const goodUser = users[9];
      const liquidatorUser = users[8];
      const borrowAmount = ethers.utils.parseUnits("5000", 6);
      let depositAmount = await theVault.getNeededCollateralFor(borrowAmount, true);
      const goodDepositAmount = ethers.utils.parseEther("20");
      const smallExtra = ethers.utils.parseUnits("0.01", 6);
      const vAssetStruct = await theVault.vAssets();
      // console.log(depositAmount/1,borrowAmount/1);

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await theVault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set up the debt position of carelessUser
      depositAmount = depositAmount.add(smallExtra);
      for (let i = 0; i < carelessUsers.length; i++) {
        await theVault
          .connect(carelessUsers[i])
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      }
      await theVault
        .connect(goodUser)
        .depositAndBorrow(goodDepositAmount, borrowAmount, { value: goodDepositAmount });

      // Staged condition to make user liquidatable
      // Careless users spends borrowed asset (transferred out of wallet for test purpose)
      for (let i = 0; i < carelessUsers.length; i++) {
        await asset.connect(carelessUsers[i]).transfer(bootstraper.address, borrowAmount);
      }
      // goodUser spends borrowed asset (transferred out of wallet for test purpose)
      await asset.connect(goodUser).transfer(bootstraper.address, borrowAmount);

      // For purposes of testing only way to make user liquidatable is by changing factors
      await theVault.connect(users[0]).setFactor(3, 2, "collatF");

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);
      // console.log("liqBalAtStart", liqBalAtStart.toString());

      // Conditional to Select Flashloan Provider
      let flashLoanProvider;

      if (
        (activeProvider === aave || activeProvider === compound) &&
        (asset === dai || asset === usdc)
      ) {
        flashLoanProvider = 2;
      } else {
        flashLoanProvider = 0;
      }

      await fliquidator
        .connect(liquidatorUser)
        .flashBatchLiquidate(
          [
            carelessUsers[0].address,
            carelessUsers[1].address,
            goodUser.address,
            carelessUsers[2].address,
            carelessUsers[3].address,
            carelessUsers[4].address,
          ],
          theVault.address,
          flashLoanProvider
        );

      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      // console.log("liqBalAtEnd", liqBalAtEnd.toString());

      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      let carelessUser1155bal0;
      let carelessUser1155bal1;

      for (let i = 0; i < carelessUsers.length; i++) {
        carelessUser1155bal0 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.collateralID
        );
        carelessUser1155bal1 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.borrowID
        );
        // console.log(`        carelessUsers[${i}]:`,"1155tokenbal0", carelessUser1155bal0/1, "1155tokenbal1", carelessUser1155bal1/1);

        await expect(carelessUser1155bal0).to.be.gt(0);
        await expect(carelessUser1155bal1).to.be.eq(0);
      }

      // const goodUser1155bal0 = await f1155.balanceOf(goodUser.address, vAssetStruct.collateralID);

      const goodUser1155bal1 = await f1155.balanceOf(goodUser.address, vAssetStruct.borrowID);
      // console.log("            goodUserBalances", `Collateral Bal: ${goodUser1155bal0/1}`, `Borrow Bal: ${goodUser1155bal1/1}`);

      await expect(goodUser1155bal1).to.be.gt(0);

      const vaultdebt = await activeProvider
        .connect(bootstraper)
        .getBorrowBalanceOf(vAssetStruct.borrowAsset, theVault.address);
      // console.log(vaultdebt.value);

      await expect(vaultdebt.value).to.equal(0);
    });
  });
});
