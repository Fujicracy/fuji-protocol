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

    it("User 1: tries deposits but not Whitelisted, then reverts", async () => {

      await expect(vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH }))
      .to.be.revertedWith('902');

    });

    it("User 1: tries to get Whitelisted, but not enough block-lag, then reverts", async () => {

      await expect(vault.connect(users[1]).addmetowhitelist())
      .to.be.revertedWith('905');

    });

    it("User 1: succeeds to get whitelisted, and deposits 1 ETH, checks cETH balance Ok", async () => {

      await vault.setActiveProvider(compound.address);

      await advanceblocks(50);

      await vault.connect(users[1]).addmetowhitelist();
      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      const rate = await ceth.exchangeRateStored();
      const cethAmount = ONE_ETH.pow(2).div(rate);
      await expect(await ceth.balanceOf(vault.address)).to.equal(cethAmount);

    });

    it("User 2: deposit but not Whitelisted", async () => {

      await expect(vault.connect(users[2]).deposit(ONE_ETH, { value: ONE_ETH })).to.be.revertedWith('902');

    });

    it("User 2: succeeds to get whitelisted, but tries deposits > 1ETH and then reverts ", async () => {

      await advanceblocks(50);

      await vault.connect(users[1]).addmetowhitelist();

      await advanceblocks(50);

      await vault.connect(users[2]).addmetowhitelist();

      await expect(vault.connect(users[2])
      .deposit("2000000000000000000", { value: "2000000000000000000" }))
      .to.be.revertedWith('901');

    });

    it("User[15]: tries to get whitelisted, but already Limit Reached, then reverts ", async () => {

      await vault.setActiveProvider(compound.address);

      for (var i = 0; i < 15; i++) {
        await advanceblocks(50);
        await vault.connect(users[i]).addmetowhitelist();
      }

      await advanceblocks(50);

      await expect(vault.connect(users[16]).addmetowhitelist()).to.be.revertedWith('904');

    });

    it("User 2: tries to get whitelisted twice, then reverts ", async () => {

      await advanceblocks(50);

      await vault.connect(users[2]).addmetowhitelist();

      await advanceblocks(50);

      await expect(vault.connect(users[2]).addmetowhitelist()).to.be.revertedWith('903');

    });


  });
});
