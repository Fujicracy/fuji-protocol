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

describe("NFT Bond Crate System", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.owner = this.users[0];
    this.user = this.users[2];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(fixture);

    this.pointsDecimals = await this.f.nftbond.POINTS_DECIMALS();

    this.evmSnapshot0 = await evmSnapshot();
  });

  beforeEach(async function () {
    if (this.evmSnapshot1) await evmRevert(this.evmSnapshot1);

    this.evmSnapshot1 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("Crate Prices", function () {
    it("Set crate prices", async function () {
      const prices = [2500, 10000, 20000].map((e) => parseUnits(e, this.pointsDecimals));
      await this.f.nftbond.setCratePrices(prices);

      for (let i = 0; i < prices.length; i++) {
        expect(await this.f.nftbond.cratePrices(i)).to.be.equal(prices[i]);
      }
    });

    it("Set more than 3 prices", async function () {
      const prices = [2500, 10000, 20000, 30000].map((e) => parseUnits(e, this.pointsDecimals));
      await expect(this.f.nftbond.setCratePrices(prices)).to.be.reverted;
    });

    it("Set less than 3 prices", async function () {
      const prices = [2500, 10000].map((e) => parseUnits(e, this.pointsDecimals));
      await expect(this.f.nftbond.setCratePrices(prices)).to.be.reverted;
    });
  });
});
