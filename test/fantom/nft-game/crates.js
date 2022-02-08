const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { BigNumber, provider } = ethers;

const { fixture, ASSETS, VAULTS, syncTime } = require("../utils");

const { WrapperBuilder } = require("redstone-evm-connector");

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

    this.pointsDecimals = await this.f.nftgame.POINTS_DECIMALS();
    this.crateIds = [
      await this.f.nftinteractions.CRATE_COMMON_ID(),
      await this.f.nftinteractions.CRATE_EPIC_ID(),
      await this.f.nftinteractions.CRATE_LEGENDARY_ID(),
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

      for (let i = 0; i < prices.length; i++) {
        await this.f.nftinteractions.setCratePrice(this.crateIds[i], prices[i]);
        expect(await this.f.nftinteractions.cratePrices(this.crateIds[i])).to.be.equal(prices[i]);
      }
    });

    it("Set invalid id price", async function () {
      const price = parseUnits(2500, this.pointsDecimals);
      const invalidId = 9999;

      await expect(this.f.nftinteractions.setCratePrice(invalidId, price)).to.be.revertedWith(
        "Invalid crate ID"
      );
    });

    it("Buying crate with no set price", async function () {
      await expect(
        this.f.nftinteractions.connect(this.user).getCrates(this.crateIds[0], 1)
      ).to.be.revertedWith("Price not set");
    });
  });

  describe("Buying Crates", function () {
    before(async function () {
      await evmRevert(this.evmSnapshot0);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.geist.address);
      }
      await this.f.nftgame.setValidVaults(VAULTS.map((v) => this.f[v.name].address));

      const prices = [2500, 10000, 20000].map((e) => parseUnits(e, this.pointsDecimals));
      for (let i = 0; i < prices.length; i++) {
        await this.f.nftinteractions.setCratePrice(this.crateIds[i], prices[i]);
      }
    });

    it("Invalid crate ID", async function () {
      const invalidId = 9999;
      await expect(
        this.f.nftinteractions.connect(this.user).getCrates(invalidId, 1)
      ).to.be.revertedWith("Invalid crate ID");
    });

    it("Buying crate without points", async function () {
      await expect(
        this.f.nftinteractions.connect(this.user).getCrates(this.crateIds[0], 1)
      ).to.be.revertedWith("Not enough points");
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
        expect(await this.f.nftgame.balanceOf(this.user.address, this.crateIds[i])).to.be.equal(0);

        await this.f.nftinteractions.connect(this.user).getCrates(this.crateIds[i], amount);

        expect(await this.f.nftgame.balanceOf(this.user.address, this.crateIds[i])).to.be.equal(
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

      let recordedPointsBalance = await this.f.nftgame.balanceOf(this.user.address, 0);
      let newPointsBalance;

      for (let i = 0; i < this.crateIds.length; i++) {
        await this.f.nftinteractions.connect(this.user).getCrates(this.crateIds[i], amount);

        expect(await this.f.nftgame.balanceOf(this.user.address, this.crateIds[i])).to.be.equal(
          amount
        );

        newPointsBalance = await this.f.nftgame.balanceOf(this.user.address, 0);
        expect(newPointsBalance === recordedPointsBalance - prices[i] * amount);
        recordedPointsBalance = newPointsBalance;
      }
    });
  });

  describe("Opening Crates", function () {
    before(async function () {
      await evmRevert(this.evmSnapshot0);

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
    });

    beforeEach(async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(5000);
      const borrowAmount = parseUnits(2000);
      const amount = 2;

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      await timeTravel(this.sec * 365);
      await vault.updateF1155Balances();

      //Redstone checks for time delay and compares timestamps. We need to increment max delay because of time traveling
      await this.f.nftinteractions.connect(this.owner).setMaxEntropyDelay(60 * 60 * 24 * 365 * 2);

      for (let i = 0; i < this.crateIds.length; i++) {
        await this.f.nftinteractions.connect(this.user).getCrates(this.crateIds[i], amount);
      }
    });

    it("Invalid crate ID", async function () {
      const invalidId = 9999;
      const localcontract = this.f.nftinteractions.connect(this.user);
      const localwrapped = WrapperBuilder.wrapLite(localcontract).usingPriceFeed("redstone", { asset: "ENTROPY" });
      await syncTime();
      await expect(
        localwrapped.openCrate(invalidId, 1)
      ).to.be.revertedWith("Invalid crate ID");
    });

    it("Rewards not set", async function () {
      const noRewardsCrate = this.crateIds[2];
      const localcontract = this.f.nftinteractions.connect(this.user);
      const localwrapped = WrapperBuilder.wrapLite(localcontract).usingPriceFeed("redstone", { asset: "ENTROPY" });
      await syncTime();
      await expect(
        localwrapped.openCrate(noRewardsCrate, 1)
      ).to.be.revertedWith("Rewards not set");
    });

    it("Not enough crates", async function () {
      const amount = 9999;
      const localcontract = this.f.nftinteractions.connect(this.user);
      const localwrapped = WrapperBuilder.wrapLite(localcontract).usingPriceFeed("redstone", { asset: "ENTROPY" });
      await syncTime();
      await expect(
        localwrapped.openCrate(this.crateIds[0], amount)
      ).to.be.revertedWith("Not enough crates");
    });

    it("Successfuly opening a crate", async function () {
      const localcontract = this.f.nftinteractions.connect(this.user);
      const localwrapped = WrapperBuilder.wrapLite(localcontract).usingPriceFeed("redstone", { asset: "ENTROPY" });
      await syncTime();
      await localwrapped.openCrate(this.crateIds[0], 1);
    });

    it("Crate balance after opnening crates", async function () {
      const bal = await this.f.nftgame.balanceOf(this.user.address, this.crateIds[0]);
      const amount = 2;
      const localcontract = this.f.nftinteractions.connect(this.user);
      const localwrapped = WrapperBuilder.wrapLite(localcontract).usingPriceFeed("redstone", { asset: "ENTROPY" });
      await syncTime();
      await localwrapped.openCrate(this.crateIds[0], amount);

      expect(await this.f.nftgame.balanceOf(this.user.address, this.crateIds[0])).to.be.equal(
        bal.sub(amount)
      );
    });
  });
});
