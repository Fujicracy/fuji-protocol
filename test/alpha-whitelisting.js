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

    await vaultdai.setActiveProvider(aave.address);
    await vaultusdc.setActiveProvider(aave.address);

  });

  describe("Alpha Whitelisting Functionality", () => {

    it("Users[0,1,2,3] added to whitelist at deploy are in fact whitelisted", async () => {

      await expect(await aWhitelist.isAddrWhitelisted(users[0].address)).to.equal(true);
      await expect(await aWhitelist.isAddrWhitelisted(users[1].address)).to.equal(true);
      await expect(await aWhitelist.isAddrWhitelisted(users[2].address)).to.equal(true);
      await expect(await aWhitelist.isAddrWhitelisted(users[3].address)).to.equal(true);

    });

    it("Users[4,5,6,7] NOT in whitelist at deploy are in fact NOT whitelisted", async () => {

      await expect(await aWhitelist.isAddrWhitelisted(users[4].address)).to.equal(false);
      await expect(await aWhitelist.isAddrWhitelisted(users[5].address)).to.equal(false);
      await expect(await aWhitelist.isAddrWhitelisted(users[6].address)).to.equal(false);
      await expect(await aWhitelist.isAddrWhitelisted(users[7].address)).to.equal(false);

    });
    it("Users[4], does NOT wait 50 blocks, then tries addmetowhitelist, reverts", async () => {

      await expect(aWhitelist.connect(users[4]).addmetowhitelist()).to.be.revertedWith('905');

    });

    it("Users[4], waits 50 blocks, then tries addmetowhitelist, succeeds", async () => {

      await advanceblocks(50);
      await aWhitelist.connect(users[4]).addmetowhitelist();
      await expect(await aWhitelist.isAddrWhitelisted(users[4].address)).to.equal(true);

    });

    it("Users[5], waits 50 blocks, then tries addmetowhitelist, list full then reverts", async () => {

      await advanceblocks(50);
      await aWhitelist.connect(users[4]).addmetowhitelist();
      await advanceblocks(50);
      await expect(aWhitelist.connect(users[5]).addmetowhitelist()).to.be.revertedWith('904');

    });

    it("Users[3], whitelisted, tries a 0.5ETH deposit in vaultusdc, succeeds", async () => {

      await expect(await vaultusdc.connect(users[3])
      .deposit(ethers.utils.parseEther("0.5"), {value: ethers.utils.parseEther("0.5")}))
      .to.changeEtherBalance(users[3],ethers.utils.parseEther("-0.5"));
      await expect(await ceth.balanceOf(vaultusdc.address)).to.be.gt(0);

    });

    it("Users[6], NOT whitelisted, tries a 0.5ETH deposit in vaultusdc, reverts", async () => {

      await expect(vaultusdc.connect(users[6])
      .deposit(ethers.utils.parseEther("0.5"), {value: ethers.utils.parseEther("0.5")}))
      .to.be.revertedWith('902');
      await expect(await ceth.balanceOf(vaultusdc.address)).to.equal(0);

    });

    it("Users[2], whitelisted, tries a 5 ETH deposit in vaultdai, reverts", async () => {

      await expect(vaultdai.connect(users[2])
      .deposit(ethers.utils.parseEther("5"), {value: ethers.utils.parseEther("5")}))
      .to.be.revertedWith('901');
      await expect(await ceth.balanceOf(vaultdai.address)).to.equal(0);

    });


  });
});
