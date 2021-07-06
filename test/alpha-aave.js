const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { fixture, evmSnapshot, evmRevert, DAI_ADDR, USDC_ADDR } = require("./utils-alpha");

// use(solidity);

describe("Alpha", () => {
  let dai;
  let usdc;
  let aweth;
  let f1155;
  let aave;
  let compound;
  let vaultdai;
  let vaultusdc;
  let vaultusdt;
  let vaultdaiusdc;
  let vaultdaiusdt;
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
    aweth = theFixture.aweth;
    f1155 = theFixture.f1155;
    aave = theFixture.aave;
    compound = theFixture.compound;
    vaultdai = theFixture.vaultdai;
    vaultusdc = theFixture.vaultusdc;
    vaultusdt = theFixture.vaultusdt;
    vaultdaiusdc = theFixture.vaultdaiusdc;
    vaultdaiusdt = theFixture.vaultdaiusdt;
    vaultdaieth = theFixture.vaultdaieth;

    await vaultdai.setActiveProvider(aave.address);
    await vaultusdc.setActiveProvider(aave.address);
    await vaultusdt.setActiveProvider(aave.address);
  });

  describe("Alpha Aave Basic Functionality", () => {
    it("1.- Users[1]: deposit 11.9999 ETH to Vaultdai, check Vaultdai aweTH balance Ok", async () => {
      const userX = users[1];
      const depositAmount = ethers.utils.parseEther("11.9999");
      const negdepositAmount = ethers.utils.parseEther("-11.9999");

      await expect(
        await vaultdai.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);
      const vaultbal = await aweth.balanceOf(vaultdai.address);

      await expect(vaultbal).to.equal(depositAmount);
    });

    it("2.- Users[1]: deposit .00001 ETH to Vaultusdc, check Vaultusdc aweth balance Ok", async () => {
      const userX = users[1];
      const depositAmount = ethers.utils.parseEther("0.00001");
      const negdepositAmount = ethers.utils.parseEther("-0.00001");

      await expect(
        await vaultusdc.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);
      const vaultbal = await aweth.balanceOf(vaultusdc.address);

      await expect(vaultbal).to.equal(depositAmount);
    });

    it("3.- Users[1]: deposit 0 ETH to Vaultusdc, Should revert", async () => {
      const userX = users[1];
      const depositAmount = ethers.utils.parseEther("0");

      await expect(
        vaultusdc.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.revertedWith("103");
    });

    it("4.- Users[1]: deposit 950 ETH to Vaultdai, exceeds ETH-CAP, should revert", async () => {
      const userX = users[1];
      const depositAmount = ethers.utils.parseEther("950");

      await expect(
        vaultdai.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.revertedWith("901");
    });

    it("5.- Users[2,4]: Two deposits to Vaultusdc, checks Vaultusdc aweTH balance Ok", async () => {
      const userX = users[2];
      const depositAmount = ethers.utils.parseEther("3");
      const negdepositAmount = ethers.utils.parseEther("-3");
      const userY = users[4];
      const depositAmountY = ethers.utils.parseEther("2");
      const negdepositAmountY = ethers.utils.parseEther("-2");

      await expect(
        await vaultusdc.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);
      await expect(
        await vaultusdc.connect(userY).deposit(depositAmountY, { value: depositAmountY })
      ).to.changeEtherBalance(userY, negdepositAmountY);

      const vaultbal = await aweth.balanceOf(vaultusdc.address);

      await expect(vaultbal).to.be.gt(depositAmount.add(depositAmountY));
    });

    it("6.- Users[5]: deposit 10 ETH in Vaultdai and then withdraws 9.9999 ETH, check VaulDai aweth balance ok", async () => {
      // Bootstrap Liquidity
      const user1 = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(user1).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(user1).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const userX = users[5];
      const depositAmount = ethers.utils.parseEther("10");
      const negdepositAmount = ethers.utils.parseEther("-10");
      const withdrawAmount = ethers.utils.parseEther("9.9999");

      await expect(
        await vaultdai.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);

      await vaultdai.depositBalance(compound.address);

      await expect(await vaultdai.connect(userX).withdraw(withdrawAmount)).to.changeEtherBalance(
        userX,
        withdrawAmount
      );

      const vAssetStruct = await vaultdai.vAssets();

      const numberExpected = depositAmount.sub(withdrawAmount);
      // console.log(numberExpected/1);
      const numberExpected2 = await f1155.balanceOf(userX.address, vAssetStruct.collateralID);
      // console.log(numberExpected2/1);

      await expect(numberExpected2 / 1).to.be.closeTo(numberExpected / 1, 10 * 1e9);
    });

    it("7.- Users[3]: deposits 5 ETH to vaultusdc and borrows 7500 usdc", async () => {
      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const userX = users[3];
      const depositAmount = ethers.utils.parseEther("5");
      const negdepositAmount = ethers.utils.parseEther("-5");
      const borrowAmount = ethers.utils.parseUnits("7500", 6);

      await expect(
        await vaultusdc.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);
      await vaultusdc.connect(userX).borrow(borrowAmount);

      await expect(await usdc.balanceOf(userX.address)).to.equal(borrowAmount);
    });

    it("8.- Users[4]: deposits 5 ETH to vaultdai, borrows 7500 dai, then paybacks 7499.9999 dai", async () => {
      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const userX = users[4];
      const depositAmount = ethers.utils.parseEther("5");
      const negdepositAmount = ethers.utils.parseEther("-5");
      const borrowAmount = ethers.utils.parseEther("7500");
      const paybackAmount = ethers.utils.parseEther("7499.9999");

      await expect(
        await vaultdai.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);
      await vaultdai.connect(userX).borrow(borrowAmount);
      await expect(await dai.balanceOf(userX.address)).to.equal(borrowAmount);
      await dai.connect(userX).approve(vaultdai.address, paybackAmount);
      await vaultdai.connect(userX).payback(paybackAmount);
      await expect(await dai.balanceOf(userX.address)).to.equal(borrowAmount.sub(paybackAmount));
    });

    it("9.- Users[2]: deposits 1 ETH to vaultusdc, tries borrows 5000 usdc , reverts", async () => {
      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const userX = users[2];
      const depositAmount = ethers.utils.parseEther("1");
      const negdepositAmount = ethers.utils.parseEther("-1");
      const borrowAmount = ethers.utils.parseUnits("5000", 6);

      await expect(
        await vaultusdc.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);
      await expect(vaultusdc.connect(userX).borrow(borrowAmount)).to.be.revertedWith("105");
    });

    it("10.- Users[2]: deposits 0.25 ETH collateral to vaultdai, and malicious Users[0] tries to withdraw 0.125 ETH , reverts", async () => {
      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const userX = users[2];
      const depositAmount = ethers.utils.parseEther("0.25");
      const negdepositAmount = ethers.utils.parseEther("-0.25");

      const userY = users[15];
      const withdrawAmount = ethers.utils.parseEther("0.125");

      await expect(
        await vaultdai.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);

      await expect(vaultdai.connect(userY).withdraw(withdrawAmount)).to.be.revertedWith("112");
    });

    it("11.- Users[11]: deposits 5 ETH to vaultdai, borrows 8000 dai, then paybacks full, and  withdraws all collateral", async () => {
      // Bootstrap Liquidity
      const bootstraper = users[19];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const userX = users[11];
      const depositAmount = ethers.utils.parseEther("5");
      const negdepositAmount = ethers.utils.parseEther("-5");
      const borrowAmount = ethers.utils.parseUnits("8000", 18);

      const ethbalOriginal = await userX.getBalance();

      await expect(
        await vaultdai.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);

      await vaultdai.connect(userX).borrow(borrowAmount);

      await expect(await dai.balanceOf(userX.address)).to.be.gt(borrowAmount);

      const vAssetStruct = await vaultdai.vAssets();

      // Facilitate userX some extra DAI to pay for debt + accrued interest
      const someextraDai = ethers.utils.parseUnits("20", 18);
      await vaultdai.connect(bootstraper).borrow(someextraDai);
      await dai.connect(bootstraper).transfer(userX.address, someextraDai);

      await dai.connect(userX).approve(vaultdai.address, borrowAmount.add(someextraDai));

      await vaultdai.connect(userX).payback(-1);

      await expect(await f1155.balanceOf(userX.address, vAssetStruct.borrowID)).to.equal(0);

      // const userCollat = await f1155.balanceOf(userX.address, vAssetStruct.collateralID);

      await vaultdai.connect(userX).withdraw(-1);

      const ethbalFinal = await userX.getBalance();

      await expect(ethbalOriginal / 1).to.be.closeTo(ethbalFinal / 1, 5e16);
    });

    it("12.- Users[16]: deposits 2 ETH to vaultusdc, borrows 3000 usdc, then paybacks 1250, and then withdraws 0.1 ETH", async () => {
      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const userX = users[16];
      const depositAmount = ethers.utils.parseEther("2");
      const negdepositAmount = ethers.utils.parseEther("-2");
      const borrowAmount = ethers.utils.parseUnits("3000", 6);
      const paybackAmount = ethers.utils.parseUnits("1250", 6);
      const withdrawAmount = ethers.utils.parseEther("0.1");

      const vAssetStruct = await vaultusdc.vAssets();

      await expect(
        await vaultusdc.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);

      await vaultusdc.connect(userX).borrow(borrowAmount);

      await expect(await usdc.balanceOf(userX.address)).to.equal(borrowAmount);

      const userdebt0 = await f1155.connect(userX).balanceOf(userX.address, vAssetStruct.borrowID);

      await usdc.connect(userX).approve(vaultusdc.address, paybackAmount);

      await vaultusdc.connect(userX).payback(paybackAmount);

      // const userdebt1 = await f1155.connect(userX).balanceOf(userX.address, vAssetStruct.borrowID);

      await expect(await usdc.balanceOf(userX.address)).to.equal(userdebt0.sub(paybackAmount));

      // const ndcollat = await vaultusdc.connect(userX).getNeededCollateralFor(userdebt1, true);
      // const collatebal = await f1155.balanceOf(userX.address, vAssetStruct.collateralID);

      await expect(await vaultusdc.connect(userX).withdraw(withdrawAmount)).to.changeEtherBalance(
        userX,
        withdrawAmount
      );
    });

    it("13.- Users[11]: Try Deposit-and-Borrow, 3 ETH deposit, 4500 DAI borrow; Vaultdai Check Balances ", async () => {
      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const theCurrentUser = users[17];
      const depositAmount = ethers.utils.parseEther("3");
      const borrowAmount = ethers.utils.parseUnits("4500", 18);

      await expect(
        await vaultdai
          .connect(theCurrentUser)
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount })
      ).to.changeEtherBalance(theCurrentUser, ethers.utils.parseEther("-3"));
      await expect(await dai.balanceOf(theCurrentUser.address)).to.equal(borrowAmount);
    });

    it("14.- Users[12]: Try Deposit-and-Borrow, 2 ETH deposit, 3000 Usdc borrow; Vaultusdc Check Balances ", async () => {
      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const theCurrentUser = users[12];
      const depositAmount = ethers.utils.parseEther("2");
      const borrowAmount = ethers.utils.parseUnits("3000", 6);

      await expect(
        await vaultusdc
          .connect(theCurrentUser)
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount })
      ).to.changeEtherBalance(theCurrentUser, ethers.utils.parseEther("-2"));
      await expect(await usdc.balanceOf(theCurrentUser.address)).to.equal(borrowAmount);
    });

    it("15.- Users[7]: Try Deposit-and-Borrow, 2 ETH deposit, 1400 DAI borrow; then Repay-and-withdraw all, Vaultdai Check Balances ", async () => {
      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const theCurrentUser = users[7];
      const depositAmount = ethers.utils.parseEther("2");
      const negdepositAmount = ethers.utils.parseEther("-2");
      const borrowAmount = ethers.utils.parseUnits("1400", 18);

      // const vAssetStruct = await vaultdai.vAssets();

      const ethbalOriginal = await theCurrentUser.getBalance();

      await expect(
        await vaultdai
          .connect(theCurrentUser)
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount })
      ).to.changeEtherBalance(theCurrentUser, negdepositAmount);

      await expect(await dai.balanceOf(theCurrentUser.address)).to.equal(borrowAmount);

      // Facilitate userX some extra amount to pay for debt + accrued interest
      const someextraDai = ethers.utils.parseUnits("20", 18);
      await vaultdai.connect(bootstraper).borrow(someextraDai);
      await dai.connect(bootstraper).transfer(theCurrentUser.address, someextraDai);

      await dai.connect(theCurrentUser).approve(vaultdai.address, borrowAmount.add(someextraDai));

      await vaultdai.connect(theCurrentUser).paybackAndWithdraw(-1, -1);

      await expect(await dai.balanceOf(theCurrentUser.address)).to.be.lt(someextraDai);

      // const f1155usertokebal = await f1155.balanceOf(theCurrentUser.address, vAssetStruct.borrowID);
      // const f1155totaltokebal = await f1155.totalSupply(vAssetStruct.borrowID);

      // console.log(f1155usertokebal/1,f1155totaltokebal/1);

      const ethbalFinal = await theCurrentUser.getBalance();

      await expect(ethbalOriginal / 1).to.be.closeTo(ethbalFinal / 1, 5e16);
    });

    it("16.- Users[8]: Try Deposit-and-Borrow, 2.5 ETH deposit, 500 Usdc borrow; then Repay-and-withdraw all, Vaultusdc Check Balances ", async () => {
      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      const theCurrentUser = users[8];
      const depositAmount = ethers.utils.parseEther("2.5");
      const negdepositAmount = ethers.utils.parseEther("-2.5");
      const borrowAmount = ethers.utils.parseUnits("500", 6);

      // const vAssetStruct = await vaultusdc.vAssets();

      const ethbalOriginal = await theCurrentUser.getBalance();

      await expect(
        await vaultusdc
          .connect(theCurrentUser)
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount })
      ).to.changeEtherBalance(theCurrentUser, negdepositAmount);

      await expect(await usdc.balanceOf(theCurrentUser.address)).to.equal(borrowAmount);

      // Facilitate userX some extra amount to pay for debt + accrued interest
      const someextrausdc = ethers.utils.parseUnits("20", 6);
      await vaultusdc.connect(bootstraper).borrow(someextrausdc);
      await usdc.connect(bootstraper).transfer(theCurrentUser.address, someextrausdc);

      await usdc
        .connect(theCurrentUser)
        .approve(vaultusdc.address, borrowAmount.add(someextrausdc));

      await vaultusdc.connect(theCurrentUser).paybackAndWithdraw(-1, -1);

      await expect(await usdc.balanceOf(theCurrentUser.address)).to.be.lt(someextrausdc);

      // const f1155usertokebal = await f1155.balanceOf(theCurrentUser.address, vAssetStruct.borrowID);
      // const f1155totaltokebal = await f1155.totalSupply(vAssetStruct.borrowID);
      // console.log(f1155usertokebal/1,f1155totaltokebal/1);

      const ethbalFinal = await theCurrentUser.getBalance();

      await expect(ethbalOriginal / 1).to.be.closeTo(ethbalFinal / 1, 5e16);
    });

    it.only("17.- Users[1]: 3 ETH deposit, 4500 DAI borrow, User[5]: 4500 DAI deposit, 2000 USDC borrow, 2000 USDC pay back and withdraw all ", async () => {
      const firstUser = users[1];
      let depositAmount = ethers.utils.parseEther("3");
      let borrowAmount = ethers.utils.parseUnits("4500", 18);

      await expect(
        await vaultdai
          .connect(firstUser)
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount })
      )
        .to.changeEtherBalance(firstUser, ethers.utils.parseEther("-3"))
        .to.changeTokenBalance(dai, firstUser, ethers.utils.parseUnits("4500", 18));

      const secondUser = users[5];
      await dai
        .connect(firstUser)
        .transfer(secondUser.address, ethers.utils.parseUnits("4500", 18));
      depositAmount = ethers.utils.parseUnits("4500", 18);
      borrowAmount = ethers.utils.parseUnits("2000", 6);
      console.log((await dai.balanceOf(secondUser.address)).toString());
      await dai.connect(secondUser).approve(vaultdaiusdc.address, depositAmount);

      console.log("start borrow");
      await expect(
        await vaultdaiusdc.connect(secondUser).depositAndBorrow(depositAmount, borrowAmount)
      )
        .to.changeTokenBalance(dai, secondUser, ethers.utils.parseUnits("-4500", 18))
        .to.changeTokenBalance(usdc, secondUser, ethers.utils.parseUnits("2000", 6));

      // Facilitate userX some extra amount to pay for debt + accrued interest
      const someextrausdc = ethers.utils.parseUnits("200", 6);

      await usdc.connect(secondUser).approve(vaultusdc.address, borrowAmount.add(someextrausdc));

      await vaultusdc.connect(secondUser).paybackAndWithdraw(-1, -1);

      await expect(await usdc.balanceOf(secondUser.address)).to.be.lt(someextrausdc);
    });
  });
});
