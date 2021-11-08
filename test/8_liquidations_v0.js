const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { fixture, evmSnapshot, evmRevert } = require("./v0-utils");

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
  let vaultdaieth;

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
    vaultdaieth = theFixture.vaultdaieth;
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

      console.log("1. User Borrows 5000 dai");
      const borrowAmount = ethers.utils.parseUnits("5000", 18);
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        smallExtra
      );

      await theVault
        .connect(carelessUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      console.log("2. Liquidator prepares dai for liquidation");
      console.log(
        "- User sends borrowed dai to liquidator. Liquidator needs dai to execute liquidation."
      );
      await asset.connect(carelessUser).transfer(liquidatorUser.address, borrowAmount);

      console.log(
        "- Bootstraper borrows and sends some extra dai to liquidator. Liquidator needs to pay for the interest"
      );
      const bstrapLiquidity = ethers.utils.parseEther("1");
      const extraChange = ethers.utils.parseUnits("1", 18);
      await theVault
        .connect(bootstraper)
        .depositAndBorrow(bstrapLiquidity, extraChange, { value: bstrapLiquidity });
      await asset.connect(bootstraper).transfer(liquidatorUser.address, extraChange);

      console.log("3. Make users position as liquidatable by changing factors");
      await theVault.connect(users[0]).setFactor(3, 2, 1);

      console.log("4. Liquidator executes batchLiquidate");

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);

      await asset
        .connect(liquidatorUser)
        .approve(fliquidator.address, borrowAmount.add(extraChange));
      await fliquidator
        .connect(liquidatorUser)
        .batchLiquidate([carelessUser.address], theVault.address);

      console.log("- Check liquidator's balance");
      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      console.log("- Check user's borrow position");
      const carelessUser1155bal0 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.collateralID
      );
      const carelessUser1155bal1 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.borrowID
      );
      await expect(carelessUser1155bal0).to.be.gt(0);
      await expect(carelessUser1155bal1).to.be.eq(0);
    });

    it("2a.- Normal batchLiquidate 3 Users, vaultUsdc", async () => {
      const theVault = vaultusdc;
      const vAssetStruct = await theVault.vAssets();
      const asset = usdc;
      const activeProvider = dydx;

      const bootstraper = users[0];
      const carelessUsers = [users[5], users[6], users[7]];
      const liquidatorUser = users[15];
      const smallExtra = ethers.utils.parseEther("0.01");

      await theVault.setActiveProvider(activeProvider.address);

      console.log("1. Users Borrows 5000 usdc");
      const borrowAmount = ethers.utils.parseUnits("5000", 6);
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        smallExtra
      );
      for (let i = 0; i < carelessUsers.length; i++) {
        await theVault
          .connect(carelessUsers[i])
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      }

      console.log("2. Liquidator prepares usdc for liquidation");
      console.log(
        "- User sends borrowed usdc to liquidator. Liquidator needs usdc to execute liquidation."
      );
      for (let i = 0; i < carelessUsers.length; i++) {
        await asset.connect(carelessUsers[i]).transfer(liquidatorUser.address, borrowAmount);
      }

      console.log(
        "- Bootstraper borrows and sends some extra usdc to liquidator. Liquidator needs to pay for the interest"
      );
      const bstrapLiquidity = ethers.utils.parseEther("1");
      const extraChange = ethers.utils.parseUnits("1", 6);
      await theVault
        .connect(bootstraper)
        .depositAndBorrow(bstrapLiquidity, extraChange, { value: bstrapLiquidity });
      await asset.connect(bootstraper).transfer(liquidatorUser.address, extraChange);

      console.log("3. Make users position as liquidatable by changing factors");
      await theVault.connect(users[0]).setFactor(3, 2, 1);

      console.log("4. Liquidator executes batchLiquidate");

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

      console.log("- Check liquidator's balance");
      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      console.log("- Check user's borrow position");
      for (let i = 0; i < carelessUsers.length; i++) {
        const carelessUser1155bal0 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.collateralID
        );
        const carelessUser1155bal1 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.borrowID
        );
        await expect(carelessUser1155bal0).to.be.gt(0);
        await expect(carelessUser1155bal1).to.be.eq(0);
      }
    });

    it("2b.- Normal batchLiquidate 3 Users + 1 non-liquidatable, vaultusdc", async () => {
      const theVault = vaultusdc;
      const vAssetStruct = await theVault.vAssets();
      const asset = usdc;
      const activeProvider = dydx;

      const bootstraper = users[0];
      const carelessUsers = [users[5], users[6], users[7]];
      const goodUser = users[11];
      const liquidatorUser = users[15];
      const smallExtra = ethers.utils.parseEther("0.01");

      await theVault.setActiveProvider(activeProvider.address);

      console.log("1. Users Borrows 5000 usdc");
      const borrowAmount = ethers.utils.parseUnits("5000", 6);
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        smallExtra
      );
      const goodDepositAmount = ethers.utils.parseEther("20");

      for (let i = 0; i < carelessUsers.length; i++) {
        await theVault
          .connect(carelessUsers[i])
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      }
      await theVault
        .connect(goodUser)
        .depositAndBorrow(goodDepositAmount, borrowAmount, { value: goodDepositAmount });

      console.log("2. Liquidator prepares usdc for liquidation");
      console.log(
        "- User sends borrowed usdc to liquidator. Liquidator needs usdc to execute liquidation."
      );
      for (let i = 0; i < carelessUsers.length; i++) {
        await asset.connect(carelessUsers[i]).transfer(liquidatorUser.address, borrowAmount);
      }
      await asset.connect(goodUser).transfer(liquidatorUser.address, borrowAmount);

      console.log(
        "- Bootstraper borrows and sends some extra usdc to liquidator. Liquidator needs to pay for the interest"
      );
      const bstrapLiquidity = ethers.utils.parseEther("1");
      const extraChange = ethers.utils.parseUnits("1", 6);
      await theVault
        .connect(bootstraper)
        .depositAndBorrow(bstrapLiquidity, extraChange, { value: bstrapLiquidity });
      await asset.connect(bootstraper).transfer(liquidatorUser.address, extraChange);

      console.log("3. Make users position as liquidatable by changing factors");
      await theVault.connect(users[0]).setFactor(3, 2, 1);

      console.log("4. Liquidator executes batchLiquidate");

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);

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

      console.log("- Check liquidator's balance");
      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      console.log("- Check user's borrow position");
      for (let i = 0; i < carelessUsers.length; i++) {
        const carelessUser1155bal0 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.collateralID
        );
        const carelessUser1155bal1 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.borrowID
        );

        await expect(carelessUser1155bal0).to.be.gt(0);
        await expect(carelessUser1155bal1).to.be.eq(0);
      }

      const goodUser1155bal1 = await f1155.balanceOf(goodUser.address, vAssetStruct.borrowID);
      await expect(goodUser1155bal1).to.be.gt(0);
    });

    it("3.- Full Flashclose User, vaultDai with aave", async () => {
      const theVault = vaultdai;
      const vAssetStruct = await theVault.vAssets();
      const user = users[6];

      await theVault.setActiveProvider(aave.address);

      console.log("1. User Borrows 3000 dai");
      const borrowAmount = ethers.utils.parseUnits("3000", 18);
      const depositAmount = ethers.utils.parseEther("5", 18);
      await theVault
        .connect(user)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      console.log("2. User calls flash close");
      await fliquidator.connect(user).flashClose(-1, theVault.address, 1);

      const user1155balCollat = await f1155.balanceOf(user.address, vAssetStruct.collateralID);
      const user1155balDebt = await f1155.balanceOf(user.address, vAssetStruct.borrowID);

      await expect(user1155balCollat).to.equal(0);
      await expect(user1155balDebt).to.equal(0);
    });

    it("4.- Full Flashclose User, vaultUsdc with aave", async () => {
      const theVault = vaultusdc;
      const vAssetStruct = await theVault.vAssets();
      const user = users[7];

      await theVault.setActiveProvider(aave.address);

      console.log("1. User Borrows 3000 usdc");
      const borrowAmount = ethers.utils.parseUnits("3000", 6);
      const depositAmount = ethers.utils.parseEther("5", 18);
      await theVault
        .connect(user)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      console.log("2. User calls flash close");
      await fliquidator.connect(user).flashClose(-1, theVault.address, 1);

      const user1155balCollat = await f1155.balanceOf(user.address, vAssetStruct.collateralID);
      const user1155balDebt = await f1155.balanceOf(user.address, vAssetStruct.borrowID);

      await expect(user1155balCollat).to.equal(0);
      await expect(user1155balDebt).to.equal(0);
    });

    it("5.- Partial Flashclose User, vaultUsdt with aave", async () => {
      const theVault = vaultusdt;
      const vAssetStruct = await theVault.vAssets();
      const user = users[8];

      await theVault.setActiveProvider(aave.address);

      console.log("1. User Borrows 7500 usdt");
      const depositAmount = ethers.utils.parseEther("10", 18);
      const borrowAmount = ethers.utils.parseUnits("7500", 6);
      await theVault
        .connect(user)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      console.log("2. User calls flash close");
      const user1155balCollat0 = await f1155.balanceOf(user.address, vAssetStruct.collateralID);
      const user1155balDebt0 = await f1155.balanceOf(user.address, vAssetStruct.borrowID);

      const partialRepayAmount = ethers.utils.parseUnits("5000", 6);
      await fliquidator.connect(user).flashClose(partialRepayAmount, theVault.address, 0);

      const user1155balCollat1 = await f1155.balanceOf(user.address, vAssetStruct.collateralID);
      const user1155balDebt1 = await f1155.balanceOf(user.address, vAssetStruct.borrowID);

      await expect(user1155balCollat1).to.be.lt(user1155balCollat0);
      await expect(user1155balDebt1).to.be.lt(user1155balDebt0);
    });

    it("6.- Partial Flashclose User, vaultUsdc with dYdX", async () => {
      const theVault = vaultusdc;
      const vAssetStruct = await theVault.vAssets();
      const user = users[10];

      await theVault.setActiveProvider(dydx.address);

      console.log("1. User Borrows 7500 usdt");
      const depositAmount = ethers.utils.parseEther("10", 18);
      const borrowAmount = ethers.utils.parseUnits("7500", 6);
      await theVault
        .connect(user)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      console.log("2. User calls flash close");
      const user1155balCollat0 = await f1155.balanceOf(user.address, vAssetStruct.collateralID);
      const user1155balDebt0 = await f1155.balanceOf(user.address, vAssetStruct.borrowID);

      const partialRepayAmount = ethers.utils.parseUnits("5000", 6);
      await fliquidator.connect(user).flashClose(partialRepayAmount, theVault.address, 0);

      const user1155balCollat1 = await f1155.balanceOf(user.address, vAssetStruct.collateralID);
      const user1155balDebt1 = await f1155.balanceOf(user.address, vAssetStruct.borrowID);

      await expect(user1155balCollat1).to.be.lt(user1155balCollat0);
      await expect(user1155balDebt1).to.be.lt(user1155balDebt0);
    });

    it("7.- FlashBatchLiquidation of 1 User, vaultDai", async () => {
      const theVault = vaultdai;
      const vAssetStruct = await theVault.vAssets();
      const asset = dai;
      const activeProvider = dydx;

      const carelessUser = users[12];
      const liquidatorUser = users[15];
      const smallExtra = ethers.utils.parseEther("0.01");

      await theVault.setActiveProvider(activeProvider.address);

      console.log("1. User Borrows 5000 dai");
      const borrowAmount = ethers.utils.parseUnits("5000", 18);
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        smallExtra
      );
      await theVault
        .connect(carelessUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      console.log("2. Make users position as liquidatable by changing factors");
      await theVault.connect(users[0]).setFactor(3, 2, 1);

      console.log("3. Liquidator executes flashBatchLiquidate");

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);

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

      console.log("- Check liquidator's balance");
      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      console.log("- Check user's borrow position");
      const carelessUser1155bal0 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.collateralID
      );
      const carelessUser1155bal1 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.borrowID
      );
      await expect(carelessUser1155bal0).to.be.gt(0);
      await expect(carelessUser1155bal1).to.be.eq(0);
    });

    it("8a.- FlashBatchLiquidation 5 Users, vaultUsdc", async () => {
      const theVault = vaultusdc;
      const vAssetStruct = await theVault.vAssets();
      const asset = usdc;
      const activeProvider = compound;

      const carelessUsers = [users[13], users[14], users[15], users[16], users[17]];
      const liquidatorUser = users[8];
      const smallExtra = ethers.utils.parseEther("0.01");

      await theVault.setActiveProvider(activeProvider.address);

      console.log("1. Users Borrow 5000 usdc");
      const borrowAmount = ethers.utils.parseUnits("5000", 6);
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        smallExtra
      );
      for (let i = 0; i < carelessUsers.length; i++) {
        await theVault
          .connect(carelessUsers[i])
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      }

      console.log("2. Make users position as liquidatable by changing factors");
      await theVault.connect(users[0]).setFactor(3, 2, 1);

      console.log("3. Liquidator executes flashBatchLiquidate");

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);

      let flashLoanProvider;
      if (
        (activeProvider === aave || activeProvider === compound) &&
        (asset === dai || asset === usdc)
      ) {
        flashLoanProvider = 1;
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

      console.log("- Check liquidator's balance");
      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      console.log("- Check user's borrow position");
      for (let i = 0; i < carelessUsers.length; i++) {
        const carelessUser1155bal0 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.collateralID
        );
        const carelessUser1155bal1 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.borrowID
        );

        await expect(carelessUser1155bal0).to.be.gt(0);
        await expect(carelessUser1155bal1).to.be.eq(0);
      }
    });

    it("8b.- FlashBatchLiquidation 5 Users, +1 nonliquidatable vaultUsdc", async () => {
      const theVault = vaultusdc;
      const vAssetStruct = await theVault.vAssets();
      const asset = usdc;
      const activeProvider = compound;

      const carelessUsers = [users[13], users[14], users[15], users[16], users[17]];
      const goodUser = users[9];
      const liquidatorUser = users[8];
      const smallExtra = ethers.utils.parseEther("0.01");

      await theVault.setActiveProvider(activeProvider.address);

      console.log("1. Users Borrow 5000 usdc");
      const borrowAmount = ethers.utils.parseUnits("5000", 6);
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        smallExtra
      );
      const goodDepositAmount = ethers.utils.parseEther("20");
      for (let i = 0; i < carelessUsers.length; i++) {
        await theVault
          .connect(carelessUsers[i])
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      }
      await theVault
        .connect(goodUser)
        .depositAndBorrow(goodDepositAmount, borrowAmount, { value: goodDepositAmount });

      console.log("2. Make users position as liquidatable by changing factors");
      await theVault.connect(users[0]).setFactor(3, 2, 1);

      console.log("3. Liquidator executes flashBatchLiquidate");

      const liqBalAtStart = await asset.balanceOf(liquidatorUser.address);

      let flashLoanProvider;
      if (
        (activeProvider === aave || activeProvider === compound) &&
        (asset === dai || asset === usdc)
      ) {
        flashLoanProvider = 1;
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

      console.log("- Check liquidator's balance");
      const liqBalAtEnd = await asset.balanceOf(liquidatorUser.address);
      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      console.log("- Check user's borrow position");
      for (let i = 0; i < carelessUsers.length; i++) {
        const carelessUser1155bal0 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.collateralID
        );
        const carelessUser1155bal1 = await f1155.balanceOf(
          carelessUsers[i].address,
          vAssetStruct.borrowID
        );

        await expect(carelessUser1155bal0).to.be.gt(0);
        await expect(carelessUser1155bal1).to.be.eq(0);
      }

      const goodUser1155bal1 = await f1155.balanceOf(goodUser.address, vAssetStruct.borrowID);
      await expect(goodUser1155bal1).to.be.gt(0);
    });

    it("9.- Normal batchLiquidate 1 User, vaultdaieth", async () => {
      const theVault = vaultdaieth;
      const vAssetStruct = await theVault.vAssets();
      const asset = dai;
      const activeProvider = compound;

      const bootstraper = users[0];
      const carelessUser = users[5];
      const liquidatorUser = users[15];

      await theVault.setActiveProvider(activeProvider.address);

      console.log("1. Bootstraper borrows 50000 dai and transfers it to the user");
      const borrowAmountForPrepare = ethers.utils.parseEther("50000");
      const depositAmountForPrepare = (
        await vaultdai.getNeededCollateralFor(borrowAmountForPrepare, true)
      ).add(ethers.utils.parseEther("0.01"));
      await vaultdai
        .connect(bootstraper)
        .depositAndBorrow(depositAmountForPrepare, borrowAmountForPrepare, {
          value: depositAmountForPrepare,
        });
      await asset.connect(bootstraper).transfer(carelessUser.address, borrowAmountForPrepare);

      console.log("2. Bootstraper deposits 3000 dai");
      const bootstraperDepositAmount = ethers.utils.parseEther("3000");
      await asset.connect(carelessUser).transfer(bootstraper.address, bootstraperDepositAmount);
      await asset.connect(bootstraper).approve(theVault.address, bootstraperDepositAmount);
      await theVault.connect(bootstraper).deposit(bootstraperDepositAmount);

      console.log("3. User borrows 1 eth");
      const borrowAmount = ethers.utils.parseEther("1");
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        ethers.utils.parseEther("10")
      );
      await asset.connect(carelessUser).approve(theVault.address, depositAmount);
      await theVault.connect(carelessUser).depositAndBorrow(depositAmount, borrowAmount);

      console.log("4. Make users position as liquidatable by changing factors");
      await theVault.connect(users[0]).setFactor(3, 2, 1);

      console.log("5. Liquidator executes batchLiquidate");

      const liqBalAtStart = await ethers.provider.getBalance(liquidatorUser.address);

      await fliquidator
        .connect(liquidatorUser)
        .batchLiquidate([carelessUser.address], theVault.address, {
          value: borrowAmount.add(ethers.utils.parseEther("0.01")),
          gasPrice: "1000000000",
        });

      console.log("- Check liquidator's balance");
      const liqBalAtEnd = await ethers.provider.getBalance(liquidatorUser.address);
      await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      console.log("- Check user's borrow position");
      const carelessUser1155bal0 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.collateralID
      );
      const carelessUser1155bal1 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.borrowID
      );
      await expect(carelessUser1155bal0).to.be.gt(0);
      await expect(carelessUser1155bal1).to.be.eq(0);
    });

    it("10.- Full Flashclose User, vaultdaieth with dydx", async () => {
      const theVault = vaultdaieth;
      const asset = dai;
      const vAssetStruct = await theVault.vAssets();
      const bootstraper = users[0];
      const user = users[11];

      await theVault.setActiveProvider(dydx.address);

      console.log("1. Bootstraper borrows 10000 dai and transfers it to the user");
      const borrowAmountForPrepare = ethers.utils.parseEther("10000");
      const depositAmountForPrepare = (
        await vaultdai.getNeededCollateralFor(borrowAmountForPrepare, true)
      ).add(ethers.utils.parseEther("0.01"));
      await vaultdai
        .connect(bootstraper)
        .depositAndBorrow(depositAmountForPrepare, borrowAmountForPrepare, {
          value: depositAmountForPrepare,
        });
      await asset.connect(bootstraper).transfer(user.address, borrowAmountForPrepare);

      console.log("2. User Borrows 1 eth");
      const borrowAmount = ethers.utils.parseEther("1");
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        ethers.utils.parseEther("10")
      );
      await asset.connect(user).approve(theVault.address, depositAmount);
      await theVault.connect(user).depositAndBorrow(depositAmount, borrowAmount);

      console.log("3. User calls flash close");
      await fliquidator.connect(user).flashClose(-1, theVault.address, 2);

      const user1155balCollat = await f1155.balanceOf(user.address, vAssetStruct.collateralID);
      const user1155balDebt = await f1155.balanceOf(user.address, vAssetStruct.borrowID);

      await expect(user1155balCollat).to.equal(0);
      await expect(user1155balDebt).to.equal(0);
    });

    it("11.- Normal FlashBatchLiquidation 1 User, vaultdaieth", async () => {
      const theVault = vaultdaieth;
      const vAssetStruct = await theVault.vAssets();
      const asset = dai;
      const activeProvider = dydx;

      const bootstraper = users[0];
      const carelessUser = users[13];
      const liquidatorUser = users[16];

      await theVault.setActiveProvider(activeProvider.address);

      console.log("1. Bootstraper borrows 50000 dai and transfers it to the user");
      const borrowAmountForPrepare = ethers.utils.parseEther("50000");
      const depositAmountForPrepare = (
        await vaultdai.getNeededCollateralFor(borrowAmountForPrepare, true)
      ).add(ethers.utils.parseEther("0.01"));
      await vaultdai
        .connect(bootstraper)
        .depositAndBorrow(depositAmountForPrepare, borrowAmountForPrepare, {
          value: depositAmountForPrepare,
        });
      await asset.connect(bootstraper).transfer(carelessUser.address, borrowAmountForPrepare);

      console.log("2. Bootstraper deposits 3000 dai");
      const bootstraperDepositAmount = ethers.utils.parseEther("3000");
      await asset.connect(carelessUser).transfer(bootstraper.address, bootstraperDepositAmount);
      await asset.connect(bootstraper).approve(theVault.address, bootstraperDepositAmount);
      await theVault.connect(bootstraper).deposit(bootstraperDepositAmount);

      console.log("3. User borrows 1 eth");
      const borrowAmount = ethers.utils.parseEther("1");
      const depositAmount = (await theVault.getNeededCollateralFor(borrowAmount, true)).add(
        ethers.utils.parseEther("10")
      );
      await asset.connect(carelessUser).approve(theVault.address, depositAmount);
      await theVault.connect(carelessUser).depositAndBorrow(depositAmount, borrowAmount);

      console.log("4. Make users position as liquidatable by changing factors");
      await theVault.connect(users[0]).setFactor(3, 2, 1);

      console.log("5. Liquidator executes flashBatchLiquidate");

      const liqBalAtStart = await ethers.provider.getBalance(liquidatorUser.address);
      console.log((await asset.balanceOf(liquidatorUser.address)).toString());

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

      console.log("- Check liquidator's balance");
      const liqBalAtEnd = await ethers.provider.getBalance(liquidatorUser.address);
      console.log((await asset.balanceOf(liquidatorUser.address)).toString());
      // await expect(liqBalAtEnd).to.be.gt(liqBalAtStart);

      console.log("- Check user's borrow position");
      const carelessUser1155bal0 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.collateralID
      );
      const carelessUser1155bal1 = await f1155.balanceOf(
        carelessUser.address,
        vAssetStruct.borrowID
      );
      await expect(carelessUser1155bal0).to.be.gt(0);
      await expect(carelessUser1155bal1).to.be.eq(0);
    });
  });
});
