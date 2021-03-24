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
  ONE_ETH
} = require("./utils-alpha.js");

//use(solidity);

describe("Alpha", () => {

  let dai;
  let usdc;
  let aweth;
  let ceth;
  let fliquidator;
  let flasher;
  let controller;
  let aave;
  let compound;
  let dydx;
  let aWhitelist;
  let vaultdai;
  let vaultusdc;
  let debtTokendai;
  let debtTokenusdc;

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
    aWhitelist = _fixture.aWhitelist;
    vaultdai = _fixture.vaultdai;
    vaultusdc = _fixture.vaultusdc;
    aweth = _fixture.aweth;
    ceth = _fixture.ceth;
    debtTokendai = _fixture.debtTokendai;
    debtTokenusdc = _fixture.debtTokenusdc;
    aave = _fixture.aave;
    compound = _fixture.compound;
    dydx = _fixture.dydx;

    await vaultdai.setActiveProvider(aave.address);
    await vaultusdc.setActiveProvider(aave.address);

  });

  describe("Alpha Aave Basic Functionality", () => {

    it("Users[1]: deposit 0.75 ETH to Vaultdai, check Vaultdai aweth balance Ok", async () => {

      await expect(await vaultdai.connect(users[1])
            .deposit(ethers.utils.parseEther("0.75"),
            { value: ethers.utils.parseEther("0.75") })).to
            .changeEtherBalance(users[1], ethers.utils.parseEther("-0.75"));
      let vaultbal = await aweth.balanceOf(vaultdai.address);
      vaultbal = vaultbal*1;
      let transfer = ethers.utils.parseEther("0.75")*1;
      await expect(vaultbal).to.be.closeTo(transfer, 1e2);

    });

    it("Users[1]: deposit 1 ETH to Vaultusdc, check Vaultusdc aweth balance Ok", async () => {

      await expect(await vaultusdc.connect(users[1])
            .deposit(ethers.utils.parseEther("1"),{ value: ethers.utils.parseEther("1")})).to
            .changeEtherBalance(users[1], ethers.utils.parseEther("-1"));
      let vaultbal = await aweth.balanceOf(vaultusdc.address);
      vaultbal = vaultbal*1;
      let transfer = ethers.utils.parseEther("1")*1;
      await expect(vaultbal).to.be
      .closeTo(transfer, 1e2);

    });

    it("Users[2,4]: both deposit 1 ETH to Vaultusdc, checks Vaultusdc aweth balance Ok", async () => {

      await advanceblocks(50);
      await aWhitelist.connect(users[4]).addmetowhitelist();
      await expect(await aWhitelist.isAddrWhitelisted(users[4].address)).to.equal(true);

      await expect(await vaultusdc.connect(users[2])
            .deposit(ethers.utils.parseEther("1"), { value: ethers.utils.parseEther("1") })).to
            .changeEtherBalance(users[2], ethers.utils.parseEther("-1"));
      await expect(await vaultusdc.connect(users[4])
            .deposit(ethers.utils.parseEther("1"), { value: ethers.utils.parseEther("1") })).to
            .changeEtherBalance(users[4], ethers.utils.parseEther("-1"));

      let vaultbal = await aweth.balanceOf(vaultusdc.address);
      vaultbal = vaultbal*1;
      let amountransfer = ethers.utils.parseEther("2")*1;

      await expect(vaultbal).to.be.closeTo(amountransfer, 1e9);

    });

    it("Users[1]: deposit 1 ETH in Vaultdai and then withdraws 0.5 ETH, check VaulDai aweth balance ok", async () => {

      await expect(await vaultdai.connect(users[1])
            .deposit(ethers.utils.parseEther("1"),{ value: ethers.utils.parseEther("1")})).to
            .changeEtherBalance(users[1], ethers.utils.parseEther("-1"));
      await expect(await vaultdai.connect(users[1])
            .withdraw(ethers.utils.parseEther("0.5"))).to
            .changeEtherBalance(users[1], ethers.utils.parseEther("0.5"));


      let vaultbal = await aweth.balanceOf(vaultdai.address);
      vaultbal = vaultbal*1;
      let amountransfer = ethers.utils.parseEther("0.5")*1;

      await expect(vaultbal).to.be.closeTo(amountransfer, 1e9);

    });

    it("Users[3]: deposits 1 ETH to vaultusdc and borrows 1000 usdc", async () => {

      await expect(await vaultusdc.connect(users[3])
            .deposit(ethers.utils.parseEther("1"),{ value: ethers.utils.parseEther("1")})).to
            .changeEtherBalance(users[3], ethers.utils.parseEther("-1"));
      await vaultusdc.connect(users[3]).borrow(ethers.utils.parseUnits("1000",6));
      await expect(await usdc.balanceOf(users[3].address))
      .to.equal(ethers.utils.parseUnits("1000", 6));

    });

    it("Users[4]: deposits 1 ETH to vaultdai, borrows 250 dai, then paybacks 125 dai", async () => {

      await advanceblocks(50);
      await aWhitelist.connect(users[4]).addmetowhitelist();
      await expect(await aWhitelist.isAddrWhitelisted(users[4].address)).to.equal(true);

      await expect(await vaultdai.connect(users[4])
            .deposit(ethers.utils.parseEther("1"),{ value: ethers.utils.parseEther("1")})).to
            .changeEtherBalance(users[4], ethers.utils.parseEther("-1"));
      await vaultdai.connect(users[4]).borrow(ethers.utils.parseEther("250"));
      await expect(await dai.balanceOf(users[4].address))
            .to.equal(ethers.utils.parseEther("250"));
      await dai.connect(users[4]).approve(vaultdai.address, ethers.utils.parseEther("125"));
      await vaultdai.connect(users[4]).payback(ethers.utils.parseEther("125"));
      await expect(await dai.balanceOf(users[4].address))
      .to.equal(ethers.utils.parseEther("125"));
    });

    it("Users[2]: deposits 1 ETH to vaultusdc, tries borrows 5000 usdc , reverts", async () => {

      await expect(await vaultusdc.connect(users[2])
            .deposit(ethers.utils.parseEther("1"),{ value: ethers.utils.parseEther("1")})).to
            .changeEtherBalance(users[2], ethers.utils.parseEther("-1"));
      await expect(vaultusdc.connect(users[2]).borrow(ethers.utils.parseUnits("5000")))
            .to.be.revertedWith('105');
    });

    it("Users[2]: deposits 0.25 ETH collateral to vaultdai, and Users[0] tries to withdraw 0.125 ETH , reverts", async () => {

      await expect(await vaultdai.connect(users[2])
            .deposit(ethers.utils.parseEther("0.25"),{ value: ethers.utils.parseEther("0.25")})).to
            .changeEtherBalance(users[2], ethers.utils.parseEther("-0.25"));
      await expect(vaultdai.connect(users[0]).withdraw(ethers.utils.parseEther("0.125"))).to
            .be.revertedWith('104');
    });


  });
});
