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
    this.crateIds = [
      await this.f.nftbond.CRATE_COMMON_ID(),
      await this.f.nftbond.CRATE_EPIC_ID(),
      await this.f.nftbond.CRATE_LEGENDARY_ID(),
    ];

    this.sec = 60 * 60 * 24;

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

    it("Set prices without permission", async function () {
      const prices = [2500, 10000, 20000].map((e) => parseUnits(e, this.pointsDecimals));
      await expect(this.f.nftbond.connect(this.user).setCratePrices(prices)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Buying Crates", function () {
    before(async function () {
      await evmRevert(this.evmSnapshot0);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.geist.address);
      }
      await this.f.nftbond.setValidVaults(VAULTS.map((v) => this.f[v.name].address));

      const prices = [2500, 10000, 20000].map((e) => parseUnits(e, this.pointsDecimals));
      await this.f.nftbond.setCratePrices(prices);
    });

    it("Invalid rarity", async function () {
      await expect(this.f.nftbond.connect(this.user).getCrates(9999, 1)).to.be.revertedWith(
        "Invalid rarity"
      );
    });

    it("Buying crate without points", async function () {
      await expect(this.f.nftbond.connect(this.user).getCrates(0, 1)).to.be.revertedWith(
        "Not enough points"
      );
    });

    it("Successfuly buying crate", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(4500);
      const borrowAmount = parseUnits(1000);
      const amount = 2;

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      await timeTravel(this.sec * 365);

      for (let i = 0; i < this.crateIds.length; i++) {
        expect(await this.f.nftbond.balanceOf(this.user.address, this.crateIds[i])).to.be.equal(0);

        await this.f.nftbond.connect(this.user).getCrates(i, amount);

        expect(await this.f.nftbond.balanceOf(this.user.address, this.crateIds[i])).to.be.equal(
          amount
        );
      }
    });

    it("Points balance after buying crates", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(4500);
      const borrowAmount = parseUnits(1000);
      const amount = 2;
      const prices = [2500, 10000, 20000].map((e) => parseUnits(e, this.pointsDecimals));

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      await timeTravel(this.sec * 365);

      let recordedPointsBalance = await this.f.nftbond.balanceOf(this.user.address, 0);
      let newPointsBalance;

      for (let i = 0; i < this.crateIds.length; i++) {
        await this.f.nftbond.connect(this.user).getCrates(i, amount);

        expect(await this.f.nftbond.balanceOf(this.user.address, this.crateIds[i])).to.be.equal(
          amount
        );

        newPointsBalance = await this.f.nftbond.balanceOf(this.user.address, 0);
        expect(newPointsBalance === recordedPointsBalance - prices[i] * amount);
        recordedPointsBalance = newPointsBalance;
      }
    });
  });
});
