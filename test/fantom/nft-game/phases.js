const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { BigNumber, provider } = ethers;

const { fixture, ASSETS, VAULTS } = require("../utils");
const {
  parseUnits,
  formatUnitsToNum,
  evmSnapshot,
  evmRevert,
  timeTravel,
} = require("../../helpers");

// ACTIONS TO TEST FOR EACH PHASE
// Points Accumulation | Crate Buying | Crate Opening | Locking | Crate Trading | NFT Card Trading

describe("NFT Bond Logic", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.admin = this.users[0];
    this.user = this.users[1];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(fixture);

    const now = (await provider.getBlock("latest")).timestamp;
    this.week = 60 * 60 * 24 * 7;
    this.phases = [now + this.week, now + 2 * this.week, now + 3 * this.week, now + 4 * this.week];
    await this.f.nftgame.connect(this.admin).setGamePhases(this.phases);

    for (let i = 0; i < VAULTS.length; i += 1) {
      const vault = VAULTS[i];
      await this.f[vault.name].setActiveProvider(this.f.geist.address);
    }
    await this.f.nftgame.setValidVaults(VAULTS.map((v) => this.f[v.name].address));

    const prices = [2500, 10000, 20000].map((e) => parseUnits(e, this.pointsDecimals));
    for (let i = 0; i < prices.length; i++) {
      await this.f.nftinteractions.setCratePrice(this.crateIds[i], prices[i]);
    }

    const factors = [
      [0, 0.9, 1.1, 2, 25],
      [0, 0.9, 1.25, 4, 50],
    ];
    for (let i = 0; i < factors.length; i++) {
      await this.f.nftinteractions.setCrateRewards(
        this.crateIds[i],
        factors[i].map((e) => e * prices[i])
      );
    }

    await this.f.nftinteractions.setMaxEntropyDelay(60 * 60 * 24 * 365 * 2);

    this.evmSnapshot0 = await evmSnapshot();
  });

  beforeEach(async function () {
    if (this.evmSnapshot1) await evmRevert(this.evmSnapshot1);

    this.evmSnapshot1 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("Before Game Start", function () {
    // it("No Points Accumulation", async function () {
    //   const vault = this.f.vaultftmdai;
    //   const depositAmount = parseUnits(2500);
    //   const borrowAmount = parseUnits(250);
    //   const time = 60 * 60 * 24 * 5; // 5 days

    //   await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
    //     value: depositAmount,
    //   });

    //   await timeTravel(time);
    //   await vault.updateF1155Balances();

    //   expect(await this.f.nftgame.balanceOf(this.user.address, 0)).to.be.equal(0);
    // });
  });

  // describe("NFT Interactions", function () {
  //   it("Set NFT Game", async function () {
  //     await expect(
  //       this.f.nftinteractions.connect(this.user).setNFTGame(this.f.nftgame.address)
  //     ).to.be.revertedWith("No permission");
  //   });
  // });
});
