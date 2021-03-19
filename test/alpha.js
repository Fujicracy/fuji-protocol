const { ethers } = require("hardhat");
const { expect } = require("chai");
const { solidity, createFixtureLoader } = require("ethereum-waffle");

const {
  fixture,
  convertToCurrencyDecimals,
  convertToWei,
  evmSnapshot,
  evmRevert,
  DAI_ADDR,
  ONE_ETH,
} = require("./utils.js");

//use(solidity);

describe("Alpha", () => {
  let dai;
  let aweth;
  let ceth;

  let fliquidator;
  let flasher;
  let controller;

  let aave;
  let compound;
  let dydx;

  let vault;
  let debtToken;

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
    vault = _fixture.vault;
    aweth = _fixture.aweth;
    ceth = _fixture.ceth;
    debtToken = _fixture.debtToken;
    aave = _fixture.aave;
    compound = _fixture.compound;

  });

  describe("Alpha Whitelisting Functionality", () => {

    it("User 1: tries deposits but not Whitelisted", async () => {

      await expect(vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH })).to.be.revertedWith('902');
    });

    it("User 1: tries to get Whitelisted, but not enough block-lag", async () => {

      await expect(vault.connect(users[1]).addmetowhitelist()).to.be.revertedWith('905');
    });

    it("User 1: succeeds to get whitelisted, and deposits 1 ETH", async () => {

      await vault.setActiveProvider(compound.address);

      for (var i = 0; i < 50; i++) {
        await ethers.provider.send("evm_mine");
      }
      await vault.connect(users[1]).addmetowhitelist();
      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      const rate = await ceth.exchangeRateStored();
      const cethAmount = ONE_ETH.pow(2).div(rate);
      await expect(await ceth.balanceOf(vault.address)).to.equal(cethAmount);
    });


  });
});
