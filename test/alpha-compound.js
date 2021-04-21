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

    it("Users[1]: deposit 4.999 ETH to Vaultdai, check Vaultdai cETH balance Ok", async () => {

      let depositAmount = ethers.utils.parseEther("4.999");
      let negdepositAmount = ethers.utils.parseEther("-4.999");

      await expect(await vaultdai.connect(users[1])
            .deposit(depositAmount,
            { value: depositAmount })).to
            .changeEtherBalance(users[1], negdepositAmount);
      let vaultbal = await ceth.balanceOf(vaultdai.address);
      vaultbal = vaultbal/1;
      let rate = await ceth.exchangeRateStored();
      let cethAmount = depositAmount*1e18/rate;
      await expect(vaultbal).to.be.closeTo(cethAmount, 100);

    });

    it("Users[1]: deposit .0001 ETH to Vaultusdc, check Vaultusdc cETH balance Ok", async () => {

      let depositAmount = ethers.utils.parseEther("0.0001");
      let negdepositAmount = ethers.utils.parseEther("-0.0001");

      await expect(await vaultdai.connect(users[1])
            .deposit(depositAmount,
            { value: depositAmount })).to
            .changeEtherBalance(users[1], negdepositAmount);
      let vaultbal = await ceth.balanceOf(vaultdai.address);
      vaultbal = vaultbal/1;
      let rate = await ceth.exchangeRateStored();
      let cethAmount = depositAmount*1e18/rate;
      await expect(vaultbal).to.be.closeTo(cethAmount, 100);

    });

    it("Users[1]: deposit 0 ETH to Vaultusdc, Should revert", async () => {

      let depositAmount = ethers.utils.parseEther("0");
      let negdepositAmount = ethers.utils.parseEther("-0");

      await expect(vaultdai.connect(users[1])
            .deposit(depositAmount,
            { value: depositAmount })).to
            .revertedWith("101");

    });

    it("Users[1]: deposit 950 ETH to Vaultusdc, should revert", async () => {

      let depositAmount = ethers.utils.parseEther("950");
      let negdepositAmount = ethers.utils.parseEther("-950");

      await expect(vaultdai.connect(users[1])
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

    it("Users[5]: deposit 10 ETH in Vaultdai and then withdraws 9.99 ETH, check VaulDai ceth balance ok", async () => {

      let user_X = users[5];
      let depositAmount = ethers.utils.parseEther("10");
      let negdepositAmount = ethers.utils.parseEther("-10");
      let withdrawAmount = ethers.utils.parseEther("9.99");

      await expect(await vaultdai.connect(user_X)
            .deposit(depositAmount,{ value: depositAmount})).to
            .changeEtherBalance(user_X, negdepositAmount);

      await vaultdai.depositBalance(compound.address);
      await compound.getDepositBalanceTest("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", vaultdai.address)

      await expect(await vaultdai.connect(user_X)
            .withdraw(withdrawAmount)).to
            .changeEtherBalance(user_X, withdrawAmount);

      let vaultbal = await ceth.balanceOf(vaultdai.address);
      vaultbal = vaultbal/1;
      let rate = await ceth.exchangeRateStored();
      let cethAmount = (depositAmount.sub(withdrawAmount))*(1e18/rate);
      await expect(vaultbal).to.be.closeTo(cethAmount, 1000000);
    });
    /*

    it("check if the borrowasset mapping is working", async () => {

      let x = await vaultdai.connect(users[1]).getBorrowAsset();
      await expect(x).to.equal(DAI_ADDR_COMP);
      let y = await vaultusdc.connect(users[1]).getBorrowAsset();
      await expect(y).to.equal(USDC_ADDR_COMP);

      await vaultdai.setActiveProvider(aave.address);
      await vaultusdc.setActiveProvider(aave.address);

      let z = await vaultdai.connect(users[1]).getBorrowAsset();
      await expect(z).to.equal(DAI_ADDR_AAVE);
      let w = await vaultusdc.connect(users[1]).getBorrowAsset();
      await expect(w).to.equal(USDC_ADDR_AAVE);

    });

    it("Users[3]: deposits 5 ETH to vaultusdc and borrows 500 usdc", async () => {

      await expect(await vaultusdc.connect(users[3])
            .deposit(ethers.utils.parseEther("5"),{ value: ethers.utils.parseEther("5")})).to
            .changeEtherBalance(users[3], ethers.utils.parseEther("-5"));
      await vaultusdc.connect(users[3]).borrow(ethers.utils.parseUnits("500",6));
      await expect(await usdc_comp.balanceOf(users[3].address))
      .to.equal(ethers.utils.parseUnits("500", 6));

    });


    it("Users[4]: deposits 5 ETH to vaultdai, borrows 10 dai, then paybacks 3 dai", async () => {

      await expect(await vaultdai.connect(users[4])
            .deposit(ethers.utils.parseEther("5"),{ value: ethers.utils.parseEther("5")})).to
            .changeEtherBalance(users[4], ethers.utils.parseEther("-5"));
      await vaultdai.connect(users[4]).borrow(ethers.utils.parseEther("10"));
      await expect(await dai_comp.balanceOf(users[4].address))
            .to.equal(ethers.utils.parseEther("10"));
      await dai_comp.connect(users[4]).approve(vaultdai.address, ethers.utils.parseEther("3"));
      await vaultdai.connect(users[4]).payback(ethers.utils.parseEther("3"));
      await expect(await dai_comp.balanceOf(users[4].address))
      .to.equal(ethers.utils.parseEther("7"));
    });

    it("Users[2]: deposits 1 ETH to vaultusdc, tries borrows 5000 usdc , reverts", async () => {

      await expect(await vaultusdc.connect(users[2])
            .deposit(ethers.utils.parseEther("1"),{ value: ethers.utils.parseEther("1")})).to
            .changeEtherBalance(users[2], ethers.utils.parseEther("-1"));
      await expect(vaultusdc.connect(users[2]).borrow(ethers.utils.parseUnits("5000")))
            .to.be.reverted;
    });

    it("Users[2]: deposits 0.25 ETH collateral to vaultdai, and Users[0] tries to withdraw 0.125 ETH , reverts", async () => {

      await expect(await vaultdai.connect(users[2])
            .deposit(ethers.utils.parseEther("0.25"),{ value: ethers.utils.parseEther("0.25")})).to
            .changeEtherBalance(users[2], ethers.utils.parseEther("-0.25"));
      await expect(vaultdai.connect(users[0]).withdraw(ethers.utils.parseEther("0.125"))).to
            .be.revertedWith('104');
    });


    it("Users[2]: deposits 5 ETH to vaultdai, borrows 10 dai, then paybacks 10 dai, and then withdraws all collateral", async () => {

      await expect(await vaultdai.connect(users[2])
            .deposit(ethers.utils.parseEther("5"),{ value: ethers.utils.parseEther("5")})).to
            .changeEtherBalance(users[2], ethers.utils.parseEther("-5"));
      await vaultdai.connect(users[2]).borrow(ethers.utils.parseEther("10"));
      await expect(await dai_comp.balanceOf(users[2].address))
            .to.equal(ethers.utils.parseEther("10"));
      let userdebt0 = await debtTokendai.connect(users[2]).balanceOf(users[2].address);
      //console.log(userdebt0/1);
      await dai_comp.connect(users[2]).approve(vaultdai.address, userdebt0);
      await vaultdai.connect(users[2]).payback(userdebt0);
      let userdebt1 = await debtTokendai.connect(users[2]).balanceOf(users[2].address);
      await expect(userdebt1).to.equal(0);
      await expect(await vaultdai.connect(users[2])
            .withdraw(ethers.utils.parseEther("5"))).to
            .changeEtherBalance(users[2], ethers.utils.parseEther("5"));
    });

    it("Users[4]: deposits 2 ETH to vaultusdc, borrows 500 usdc, then paybacks 500 usdc, and then withdraws all collateral", async () => {

      await expect(await vaultusdc.connect(users[4])
            .deposit(ethers.utils.parseEther("2"),{ value: ethers.utils.parseEther("2")})).to
            .changeEtherBalance(users[4], ethers.utils.parseEther("-2"));
      await vaultusdc.connect(users[4]).borrow(ethers.utils.parseUnits("500",6));
      await expect(await usdc_comp.balanceOf(users[4].address))
            .to.equal(ethers.utils.parseUnits("500",6));
      let userdebt0 = await debtTokenusdc.connect(users[4]).balanceOf(users[4].address);
      //console.log(userdebt0/1);
      await usdc_comp.connect(users[4]).approve(vaultusdc.address, userdebt0);
      await vaultusdc.connect(users[4]).payback(userdebt0);
      let userdebt1 = await debtTokenusdc.connect(users[4]).balanceOf(users[4].address);
      await expect(userdebt1).to.equal(0);
      await expect(await vaultusdc.connect(users[4])
            .withdraw(ethers.utils.parseEther("2"))).to
            .changeEtherBalance(users[4], ethers.utils.parseEther("2"));
    });


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
