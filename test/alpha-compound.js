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
  ETH_ADDR,
  ONE_ETH
} = require("./utils-alpha.js");

//use(solidity);

describe("Alpha", () => {

  let dai;
  let usdc;
  let aweth;
  let ceth;
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
    aweth = _fixture.aweth;
    ceth = _fixture.ceth;
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
    /*

    it("Users[1]: deposit 11.9999 ETH to Vaultdai, check Vaultdai cETH balance Ok", async () => {

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

    it("Users[1]: deposit .00001 ETH to Vaultusdc, check Vaultusdc cETH balance Ok", async () => {

      let user_X = users[1];
      let depositAmount = ethers.utils.parseEther("0.00001");
      let negdepositAmount = ethers.utils.parseEther("-0.00001");

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

    it("Users[1]: deposit 0 ETH to Vaultusdc, Should revert", async () => {

      let user_X = users[1];
      let depositAmount = ethers.utils.parseEther("0");
      let negdepositAmount = ethers.utils.parseEther("-0");

      await expect(vaultdai.connect(user_X)
            .deposit(depositAmount,
            { value: depositAmount })).to
            .revertedWith("101");

    });

    it("Users[1]: deposit 950 ETH to Vaultusdc, exceeds ETH-CAP, should revert", async () => {

      let user_X = users[1];
      let depositAmount = ethers.utils.parseEther("950");
      let negdepositAmount = ethers.utils.parseEther("-950");

      await expect(vaultdai.connect(user_X)
            .deposit(depositAmount,
            { value: depositAmount })).to
            .revertedWith("904");

    });


    it("Users[2,4]: Two deposits to Vaultusdc, checks Vaultusdc cETH balance Ok", async () => {

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
    */


    it("Users[5]: deposit 10 ETH in Vaultdai and then withdraws 9.9999 ETH, check VaulDai ceth balance ok", async () => {

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
      await compound.getDepositBalanceTest("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", vaultdai.address)

      await expect(await vaultdai.connect(user_X)
            .withdraw(withdrawAmount)).to
            .changeEtherBalance(user_X, withdrawAmount);

      let numberExpected = depositAmount.sub(withdrawAmount)/1;
      let numberExpected2 = await f1155.balanceOf(user_X.address,1);

      await expect(numberExpected2/1).to.be.closeTo(numberExpected, 10*1e9);

    });
    /*


    it("Users[3]: deposits 5 ETH to vaultusdc and borrows 7500 usdc", async () => {

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



    it("Users[4]: deposits 5 ETH to vaultdai, borrows 7500 dai, then paybacks 7499.9999 dai", async () => {

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


    it("Users[2]: deposits 1 ETH to vaultusdc, tries borrows 5000 usdc , reverts", async () => {

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

    it("Users[2]: deposits 0.25 ETH collateral to vaultdai, and Users[0] tries to withdraw 0.125 ETH , reverts", async () => {

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


    it("Users[11]: deposits 5 ETH to vaultdai, borrows 9000 dai, then paybacks full, and  withdraws all collateral", async () => {

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

      let vaultdaiAssetStruct = await vaultdai.vAssets();

      await dai.connect(user_X).approve(vaultdai.address, borrowAmount);

      await vaultdai.connect(user_X).payback(-1);

      await expect(await f1155.balanceOf(user_X.address, vaultdaiAssetStruct.borrowID)).to.equal(0);

      let userCollat = await f1155.balanceOf(user_X.address, vaultdaiAssetStruct.collateralID);

      await expect(await vaultdai.connect(user_X).withdraw(-1)).to
            .changeEtherBalance(user_X,userCollat);
    });
    */


    it("Users[16]: deposits 2 ETH to vaultusdc, borrows 3000 usdc, then paybacks 1250, and then withdraws 0.1 ETH", async () => {

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

      let vaultAssetStruct = await vaultusdc.vAssets();

      await expect(await vaultusdc.connect(user_X)
            .deposit(depositAmount,{ value: depositAmount})).to
            .changeEtherBalance(user_X, negdepositAmount);

      await vaultusdc.connect(user_X).borrow(borrowAmount);

      await expect(await usdc.balanceOf(user_X.address))
            .to.equal(borrowAmount);

      let userdebt0 = await f1155.connect(user_X).balanceOf(user_X.address,vaultAssetStruct.borrowID);

      await usdc.connect(user_X).approve(vaultusdc.address, paybackAmount);

      await vaultusdc.connect(user_X).payback(paybackAmount);

      let userdebt1 = await f1155.connect(user_X).balanceOf(user_X.address,vaultAssetStruct.borrowID);

      await expect(await usdc.balanceOf(user_X.address)).to.equal(userdebt0.sub(paybackAmount));

      let ndcollat = await vaultusdc.connect(user_X).getNeededCollateralFor(userdebt1,true);
      let collatebal = await f1155.balanceOf(user_X.address, vaultAssetStruct.collateralID);

      await expect(await vaultusdc.connect(user_X)
            .withdraw(withdrawAmount)).to
            .changeEtherBalance(user_X, withdrawAmount);
    });
    /*


    it("Users[11]: Try Deposit-and-Borrow, 3 ETH deposit, 400 DAI borrow; Vaultdai Check Balances ", async () => {

      let theCurrentUser = users[11];
      let depositAmount = ethers.utils.parseEther("3");
      let borrowAmount = ethers.utils.parseEther("400");

      await expect(await vaultdai.connect(theCurrentUser)
            .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount})).to
            .changeEtherBalance(theCurrentUser, ethers.utils.parseEther("-3"));
      await expect(await dai_comp.balanceOf(theCurrentUser.address))
            .to.equal(borrowAmount);

    });

    it("Users[12]: Try Deposit-and-Borrow, 2 ETH deposit, 600 Usdc borrow; Vaultusdc Check Balances ", async () => {

      let theCurrentUser = users[12];
      let depositAmount = ethers.utils.parseEther("2");
      let borrowAmount = ethers.utils.parseUnits("600",6);

      await expect(await vaultusdc.connect(theCurrentUser)
            .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount})).to
            .changeEtherBalance(theCurrentUser, ethers.utils.parseEther("-2"));
      await expect(await usdc_comp.balanceOf(theCurrentUser.address))
            .to.equal(borrowAmount);

    });

    it("Users[7]: Try Deposit-and-Borrow, 1 ETH deposit, 100 DAI borrow; then Repay-and-withdraw all, Vaultdai Check Balances ", async () => {

      let theCurrentUser = users[7];
      let depositAmount = ethers.utils.parseEther("1");
      let borrowAmount = ethers.utils.parseEther("100");

      await expect(await vaultdai.connect(theCurrentUser)
            .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount})).to
            .changeEtherBalance(theCurrentUser, ethers.utils.parseEther("-1"));
      await expect(await dai_comp.balanceOf(theCurrentUser.address))
            .to.equal(borrowAmount);

      await dai_comp.connect(theCurrentUser).approve(vaultdai.address, borrowAmount);

      await expect(await vaultdai.connect(theCurrentUser)
            .paybackAndWithdraw(borrowAmount, depositAmount)).to
            .changeEtherBalance(theCurrentUser, depositAmount);
    });

    it("Users[8]: Try Deposit-and-Borrow, 2.5 ETH deposit, 500 Usdc borrow; then Repay-and-withdraw all, Vaultusdc Check Balances ", async () => {

      let theCurrentUser = users[8];
      let depositAmount = ethers.utils.parseEther("2.5");
      let borrowAmount = ethers.utils.parseUnits("500",6);

      await expect(await vaultusdc.connect(theCurrentUser)
            .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount})).to
            .changeEtherBalance(theCurrentUser, ethers.utils.parseEther("-2.5"));
      await expect(await usdc_comp.balanceOf(theCurrentUser.address))
            .to.equal(borrowAmount);

      await usdc_comp.connect(theCurrentUser).approve(vaultusdc.address, borrowAmount);

      await expect(await vaultusdc.connect(theCurrentUser)
            .paybackAndWithdraw(borrowAmount,depositAmount)).to
            .changeEtherBalance(theCurrentUser, depositAmount);
    });
    */

  });
});
