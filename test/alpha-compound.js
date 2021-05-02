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
  ETH_ADDR,
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

    await vaultdai.setActiveProvider(compound.address);
    await vaultusdc.setActiveProvider(compound.address);

  });

  describe("Alpha Compound Basic Functionality", () => {

    it("1.- Users[1]: deposit 11.9999 ETH to Vaultdai, check Vaultdai cETH balance Ok", async () => {

      let user_X = users[1];
      let depositAmount = ethers.utils.parseEther("11.9999");
      let negdepositAmount = ethers.utils.parseEther("-11.9999");

      await expect(await vaultdai.connect(user_X)
            .deposit(depositAmount,
            { value: depositAmount })).to
            .changeEtherBalance(user_X, negdepositAmount);
      let vaultbal = await ceth.balanceOf(vaultdai.address);
      vaultbal = vaultbal/1;
      let rate = await ceth.exchangeRateStored();
      let cethAmount = depositAmount*1e18/rate;
      await expect(vaultbal).to.be.closeTo(cethAmount, 100);

    });

    it("2.- Users[1]: deposit .00001 ETH to Vaultusdc, check Vaultusdc cETH balance Ok", async () => {

      let user_X = users[1];
      let depositAmount = ethers.utils.parseEther("0.00001");
      let negdepositAmount = ethers.utils.parseEther("-0.00001");

      await expect(await vaultusdc.connect(user_X)
            .deposit(depositAmount,
            { value: depositAmount })).to
            .changeEtherBalance(user_X, negdepositAmount);
      let vaultbal = await ceth.balanceOf(vaultusdc.address);
      vaultbal = vaultbal/1;
      let rate = await ceth.exchangeRateStored();
      let cethAmount = depositAmount*1e18/rate;
      await expect(vaultbal).to.be.closeTo(cethAmount, 100);

    });

    it("3.- Users[1]: deposit 0 ETH to Vaultusdc, Should revert", async () => {

      let user_X = users[1];
      let depositAmount = ethers.utils.parseEther("0");
      let negdepositAmount = ethers.utils.parseEther("-0");

      await expect(vaultusdc.connect(user_X)
            .deposit(depositAmount,
            { value: depositAmount })).to
            .revertedWith("103");

    });

    it("4.- Users[1]: deposit 950 ETH to Vaultdai, exceeds ETH-CAP, should revert", async () => {

      let user_X = users[1];
      let depositAmount = ethers.utils.parseEther("950");
      let negdepositAmount = ethers.utils.parseEther("-950");

      await expect(vaultdai.connect(user_X)
            .deposit(depositAmount,
            { value: depositAmount })).to
            .revertedWith("901");

    });

    it("5.- Users[2,4]: Two deposits to Vaultusdc, checks Vaultusdc cETH balance Ok", async () => {

      let user_X = users[2];
      let depositAmount = ethers.utils.parseEther("3");
      let negdepositAmount = ethers.utils.parseEther("-3");
      let user_Y = users[4];
      let depositAmount_Y = ethers.utils.parseEther("2");
      let negdepositAmount_Y = ethers.utils.parseEther("-2");

      await expect(await vaultusdc.connect(user_X)
            .deposit(depositAmount, { value: depositAmount })).to
            .changeEtherBalance(user_X, negdepositAmount);
      await expect(await vaultusdc.connect(user_Y)
            .deposit(depositAmount_Y, { value: depositAmount_Y })).to
            .changeEtherBalance(user_Y, negdepositAmount_Y);

      let vaultbal = await ceth.balanceOf(vaultusdc.address);
      vaultbal = vaultbal/1;
      let rate = await ceth.exchangeRateStored();
      let cethAmount = (depositAmount.add(depositAmount_Y))*(1e18/rate);
      await expect(vaultbal).to.be.closeTo(cethAmount, 100);

    });

    it("6.- Users[5]: deposit 10 ETH in Vaultdai and then withdraws 9.9999 ETH, check VaulDai ceth balance ok", async () => {

      //Bootstrap Liquidity
      let user_1 = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(users[0]).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(users[0]).deposit(bstrapLiquidity,{ value: bstrapLiquidity });


      let user_X = users[5];
      let depositAmount = ethers.utils.parseEther("10");
      let negdepositAmount = ethers.utils.parseEther("-10");
      let withdrawAmount = ethers.utils.parseEther("9.9999");

      await expect(await vaultdai.connect(user_X)
            .deposit(depositAmount,{ value: depositAmount})).to
            .changeEtherBalance(user_X, negdepositAmount);

      await vaultdai.depositBalance(compound.address);
      await compound.getDepositBalanceTest("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", vaultdai.address);

      await expect(await vaultdai.connect(user_X)
            .withdraw(withdrawAmount)).to
            .changeEtherBalance(user_X, withdrawAmount);

      let vAssetStruct = await vaultdai.vAssets();

      let numberExpected = depositAmount.sub(withdrawAmount);
      //console.log(numberExpected/1);
      let numberExpected2 = await f1155.balanceOf(user_X.address, vAssetStruct.collateralID);
      //console.log(numberExpected2/1);

      await expect(numberExpected2/1).to.be.closeTo(numberExpected/1, 10*1e9);

    });

    it("7.- Users[3]: deposits 5 ETH to vaultusdc and borrows 7500 usdc", async () => {

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      let user_X = users[3];
      let depositAmount = ethers.utils.parseEther("5");
      let negdepositAmount = ethers.utils.parseEther("-5");
      let borrowAmount = ethers.utils.parseUnits("7500",6);

      await expect(await vaultusdc.connect(user_X)
            .deposit(depositAmount,{ value: depositAmount})).to
            .changeEtherBalance(user_X, negdepositAmount);
      await vaultusdc.connect(user_X).borrow(borrowAmount);

      await expect(await usdc.balanceOf(user_X.address))
      .to.equal(borrowAmount);

    });

    it("8.- Users[4]: deposits 5 ETH to vaultdai, borrows 7500 dai, then paybacks 7499.9999 dai", async () => {

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      let user_X = users[4];
      let depositAmount = ethers.utils.parseEther("5");
      let negdepositAmount = ethers.utils.parseEther("-5");
      let borrowAmount = ethers.utils.parseEther("7500");
      let paybackAmount = ethers.utils.parseEther("7499.9999");

      await expect(await vaultdai.connect(user_X)
            .deposit(depositAmount,{ value: depositAmount})).to
            .changeEtherBalance(user_X, negdepositAmount);
      await vaultdai.connect(user_X).borrow(borrowAmount);
      await expect(await dai.balanceOf(user_X.address))
            .to.equal(borrowAmount);
      await dai.connect(user_X).approve(vaultdai.address, paybackAmount);
      await vaultdai.connect(user_X).payback(paybackAmount);
      await expect(await dai.balanceOf(user_X.address)).to.equal(borrowAmount.sub(paybackAmount));

    });


    it("9.- Users[2]: deposits 1 ETH to vaultusdc, tries borrows 5000 usdc , reverts", async () => {

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      let user_X = users[2];
      let depositAmount = ethers.utils.parseEther("1");
      let negdepositAmount = ethers.utils.parseEther("-1");
      let borrowAmount = ethers.utils.parseUnits("5000",6);

      await expect(await vaultusdc.connect(user_X)
            .deposit(depositAmount,{ value: depositAmount})).to
            .changeEtherBalance(user_X, negdepositAmount);
      await expect(vaultusdc.connect(user_X).borrow(borrowAmount))
            .to.be.revertedWith('105');
    });

    it("10.- Users[2]: deposits 0.25 ETH collateral to vaultdai, and malicious Users[0] tries to withdraw 0.125 ETH , reverts", async () => {

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      let user_X = users[2];
      let depositAmount = ethers.utils.parseEther("0.25");
      let negdepositAmount = ethers.utils.parseEther("-0.25");

      let user_Y = users[15];
      let withdrawAmount = ethers.utils.parseEther("0.125");

      await expect(await vaultdai.connect(user_X)
            .deposit(depositAmount,{ value: depositAmount})).to
            .changeEtherBalance(user_X, negdepositAmount);

      await expect(vaultdai.connect(user_Y).withdraw(withdrawAmount)).to
            .be.revertedWith('112');
    });

    it("11.- Users[11]: deposits 5 ETH to vaultdai, borrows 9000 dai, then paybacks full, and  withdraws all collateral", async () => {

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      let user_X = users[11];
      let depositAmount = ethers.utils.parseEther("5");
      let negdepositAmount = ethers.utils.parseEther("-5");
      let borrowAmount = ethers.utils.parseUnits("8000", 18);

      await expect(await vaultdai.connect(user_X)
            .deposit(depositAmount,{ value: depositAmount})).to
            .changeEtherBalance(user_X, negdepositAmount);

      await vaultdai.connect(user_X).borrow(borrowAmount);

      await expect(await dai.balanceOf(user_X.address)).to.equal(borrowAmount);

      let vAssetStruct = await vaultdai.vAssets();

      await dai.connect(user_X).approve(vaultdai.address, borrowAmount);

      await vaultdai.connect(user_X).payback(-1);

      await expect(await f1155.balanceOf(user_X.address, vAssetStruct.borrowID)).to.equal(0);

      let userCollat = await f1155.balanceOf(user_X.address, vAssetStruct.collateralID);

      await expect(await vaultdai.connect(user_X).withdraw(-1)).to
            .changeEtherBalance(user_X,userCollat);
    });

    it("12.- Users[16]: deposits 2 ETH to vaultusdc, borrows 3000 usdc, then paybacks 1250, and then withdraws 0.1 ETH", async () => {

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      let user_X = users[16];
      let depositAmount = ethers.utils.parseEther("2");
      let negdepositAmount = ethers.utils.parseEther("-2");
      let borrowAmount = ethers.utils.parseUnits("3000", 6);
      let paybackAmount = ethers.utils.parseUnits("1250", 6);
      let withdrawAmount = ethers.utils.parseEther("0.1");

      let vAssetStruct = await vaultusdc.vAssets();

      await expect(await vaultusdc.connect(user_X)
            .deposit(depositAmount,{ value: depositAmount})).to
            .changeEtherBalance(user_X, negdepositAmount);

      await vaultusdc.connect(user_X).borrow(borrowAmount);

      await expect(await usdc.balanceOf(user_X.address))
            .to.equal(borrowAmount);

      let userdebt0 = await f1155.connect(user_X).balanceOf(user_X.address,vAssetStruct.borrowID);

      await usdc.connect(user_X).approve(vaultusdc.address, paybackAmount);

      await vaultusdc.connect(user_X).payback(paybackAmount);

      let userdebt1 = await f1155.connect(user_X).balanceOf(user_X.address,vAssetStruct.borrowID);

      await expect(await usdc.balanceOf(user_X.address)).to.equal(userdebt0.sub(paybackAmount));

      let ndcollat = await vaultusdc.connect(user_X).getNeededCollateralFor(userdebt1,true);
      let collatebal = await f1155.balanceOf(user_X.address, vAssetStruct.collateralID);

      await expect(await vaultusdc.connect(user_X)
            .withdraw(withdrawAmount)).to
            .changeEtherBalance(user_X, withdrawAmount);
    });

    it("13.- Users[11]: Try Deposit-and-Borrow, 3 ETH deposit, 4500 DAI borrow; Vaultdai Check Balances ", async () => {

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      let theCurrentUser = users[11];
      let depositAmount = ethers.utils.parseEther("3");
      let borrowAmount = ethers.utils.parseUnits("4500",18);

      await expect(await vaultdai.connect(theCurrentUser)
            .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount})).to
            .changeEtherBalance(theCurrentUser, ethers.utils.parseEther("-3"));
      await expect(await dai.balanceOf(theCurrentUser.address))
            .to.equal(borrowAmount);

    });

    it("14.- Users[12]: Try Deposit-and-Borrow, 2 ETH deposit, 3000 Usdc borrow; Vaultusdc Check Balances ", async () => {

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      let theCurrentUser = users[12];
      let depositAmount = ethers.utils.parseEther("2");
      let borrowAmount = ethers.utils.parseUnits("3000",6);

      await expect(await vaultusdc.connect(theCurrentUser)
            .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount})).to
            .changeEtherBalance(theCurrentUser, ethers.utils.parseEther("-2"));
      await expect(await usdc.balanceOf(theCurrentUser.address))
            .to.equal(borrowAmount);

    });

    it("15.- Users[7]: Try Deposit-and-Borrow, 2 ETH deposit, 1400 DAI borrow; then Repay-and-withdraw all, Vaultdai Check Balances ", async () => {

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      let theCurrentUser = users[7];
      let depositAmount = ethers.utils.parseEther("2");
      let negdepositAmount = ethers.utils.parseEther("-2");
      let borrowAmount = ethers.utils.parseUnits("1400",18);

      let vAssetStruct = await vaultdai.vAssets();

      let ethbalOriginal = await theCurrentUser.getBalance();

      await expect(await vaultdai.connect(theCurrentUser)
            .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount})).to
            .changeEtherBalance(theCurrentUser, negdepositAmount);

      await expect(await dai.balanceOf(theCurrentUser.address))
            .to.equal(borrowAmount);

      await dai.connect(theCurrentUser).approve(vaultdai.address, borrowAmount);

      await vaultdai.connect(theCurrentUser).paybackAndWithdraw(-1, -1);

      await expect(await dai.balanceOf(theCurrentUser.address)).to.equal(0);

      let f1155usertokebal = await f1155.balanceOf(theCurrentUser.address, vAssetStruct.borrowID);
      let f1155totaltokebal = await f1155.totalSupply(vAssetStruct.borrowID);
      let balanceATCompound = await compound.getDepositBalanceTest(dai.address, vaultdai.address);
      //console.log(f1155usertokebal/1,f1155totaltokebal/1,balanceATCompound.value/1);

      let ethbalFinal = await theCurrentUser.getBalance();
      ethbalFinal =ethbalFinal/1

      await expect(ethbalOriginal/1).to.be.closeTo(ethbalFinal, 2e16);
    });

    it("16.- Users[8]: Try Deposit-and-Borrow, 2.5 ETH deposit, 500 Usdc borrow; then Repay-and-withdraw all, Vaultusdc Check Balances ", async () => {

      //Bootstrap Liquidity
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });
      await vaultusdc.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      let theCurrentUser = users[8];
      let depositAmount = ethers.utils.parseEther("2.5");
      let negdepositAmount = ethers.utils.parseEther("-2.5");
      let borrowAmount = ethers.utils.parseUnits("500",6);

      let vAssetStruct = await vaultusdc.vAssets();

      let ethbalOriginal = await theCurrentUser.getBalance();

      await expect(await vaultusdc.connect(theCurrentUser)
            .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount})).to
            .changeEtherBalance(theCurrentUser, negdepositAmount);

      await expect(await usdc.balanceOf(theCurrentUser.address))
            .to.equal(borrowAmount);

      await usdc.connect(theCurrentUser).approve(vaultusdc.address, borrowAmount);

      await vaultusdc.connect(theCurrentUser).paybackAndWithdraw(-1, -1);

      await expect(await usdc.balanceOf(theCurrentUser.address)).to.equal(0);

      let f1155usertokebal = await f1155.balanceOf(theCurrentUser.address, vAssetStruct.borrowID);
      let f1155totaltokebal = await f1155.totalSupply(vAssetStruct.borrowID);
      let balanceATCompound = await compound.getDepositBalanceTest(usdc.address, vaultusdc.address);
      //console.log(f1155usertokebal/1,f1155totaltokebal/1,balanceATCompound.value/1);

      let ethbalFinal = await theCurrentUser.getBalance();
      ethbalFinal =ethbalFinal/1

      await expect(ethbalOriginal/1).to.be.closeTo(ethbalFinal, 2e16);
    });

  });
});
