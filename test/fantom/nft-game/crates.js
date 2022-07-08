const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { BigNumber, provider } = ethers;

const { WrapperBuilder } = require("redstone-evm-connector");

const {  syncTime } = require("../utils");
const { quickFixture, VAULTS } = require("./fixtures/quick_test_fixture");

const {
  parseUnits,
  formatUnitsToNum,
  evmSnapshot,
  evmRevert,
  timeTravel,
} = require("../../helpers");

/**
 * @note Returns the etherjs contract according to oracle choice in NFTInteractions contract.
 * @param interactionContract Etherjs contract object representing 'NFTInteractions.sol'.
 * @param wallet Ethersjs wallet object.
 */
const gameEntropySelector = async function (interactionContract, wallet) {
  const bool = await interactionContract.isRedstoneOracleOn();
  const contract = !bool
    ? interactionContract.connect(wallet)
    : WrapperBuilder.wrapLite(interactionContract.connect(wallet)).usingPriceFeed("redstone", {
        asset: "ENTROPY",
      });
  return contract;
};

describe("NFT Bond Crate System", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.owner = this.users[0];
    this.user = this.users[2];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(quickFixture);

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
      const prices = [250, 1000, 2000].map((e) => parseUnits(e, this.pointsDecimals));

      for (let i = 0; i < prices.length; i++) {
        await this.f.nftinteractions.setCratePrice(this.crateIds[i], prices[i]);
        expect(await this.f.nftinteractions.cratePrices(this.crateIds[i])).to.be.equal(prices[i]);
      }
    });

    it("Set invalid id price", async function () {
      const price = parseUnits(2500, this.pointsDecimals);
      const invalidId = 9999;

      await expect(this.f.nftinteractions.setCratePrice(invalidId, price)).to.be.revertedWith(
        "G02"
      );
    });

    it("Buying crate with no set price", async function () {
      await expect(
        this.f.nftinteractions.connect(this.user).mintCrates(this.crateIds[0], 1)
      ).to.be.revertedWith("G01");
    });
  });

  describe("Buying Crates", function () {
    before(async function () {
      await evmRevert(this.evmSnapshot0);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.hundred.address);
      }
      await this.f.nftgame.setValidVaults(VAULTS.map((v) => this.f[v.name].address));

      const now = (await provider.getBlock("latest")).timestamp;
      const week = 60 * 60 * 24 * 7;
      const phases = [now, now + 100 * week, now + 200 * week, now + 300 * week];

      await this.f.nftgame.setGamePhases(phases);

      const prices = [250, 1000, 2000].map((e) => parseUnits(e, this.pointsDecimals));
      for (let i = 0; i < prices.length; i++) {
        await this.f.nftinteractions.setCratePrice(this.crateIds[i], prices[i]);
      }
    });

    it("Invalid crate ID", async function () {
      const invalidId = 9999;
      await expect(
        this.f.nftinteractions.connect(this.user).mintCrates(invalidId, 1)
      ).to.be.revertedWith("G02");
    });

    it("Buying crate without points", async function () {
      await expect(
        this.f.nftinteractions.connect(this.user).mintCrates(this.crateIds[0], 1)
      ).to.be.revertedWith("G05");
    });

    it("Successfuly buying crate", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(8000);
      const borrowAmount = parseUnits(500);
      const amount = 2;

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      await timeTravel(this.sec * 365);

      for (let i = 0; i < this.crateIds.length; i++) {
        expect(await this.f.nftgame.balanceOf(this.user.address, this.crateIds[i])).to.be.equal(0);

        await this.f.nftinteractions.connect(this.user).mintCrates(this.crateIds[i], amount);

        expect(await this.f.nftgame.balanceOf(this.user.address, this.crateIds[i])).to.be.equal(
          amount
        );
      }
    });

    it("Points balance after buying crates", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(8000);
      const borrowAmount = parseUnits(500);
      const amount = 2;
      const prices = [250, 1000, 2000].map((e) => parseUnits(e, this.pointsDecimals));

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      await timeTravel(this.sec * 365);

      let recordedPointsBalance = await this.f.nftgame.balanceOf(this.user.address, 0);
      let newPointsBalance;

      for (let i = 0; i < this.crateIds.length; i++) {
        await this.f.nftinteractions.connect(this.user).mintCrates(this.crateIds[i], amount);

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
        await this.f[vault.name].setActiveProvider(this.f.hundred.address);
      }
      await this.f.nftgame.setValidVaults(VAULTS.map((v) => this.f[v.name].address));

      const now = (await provider.getBlock("latest")).timestamp;
      const week = 60 * 60 * 24 * 7;
      const phases = [now, now + 100 * week, now + 200 * week, now + 300 * week];

      await this.f.nftgame.setGamePhases(phases);

      const prices = [250, 1000, 2000].map((e) => parseUnits(e, this.pointsDecimals));
      for (let i = 0; i < prices.length; i++) {
        await this.f.nftinteractions.setCratePrice(this.crateIds[i], prices[i]);
      }

      const factors = [
        [0, 0.9, 1.1, 2, 25],
        [0, 0.9, 1.25, 4, 50],
        [0]
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
      const borrowAmount = parseUnits(500);
      const amount = 2;

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      await timeTravel(this.sec * 365);
      await vault.updateF1155Balances();

      // Redstone checks for time delay and compares timestamps. We need to increment max delay because of time traveling
      await this.f.nftinteractions.connect(this.owner).setMaxEntropyDelay(60 * 60 * 24 * 365 * 2);

      for (let i = 0; i < this.crateIds.length; i++) {
        await this.f.nftinteractions.connect(this.user).mintCrates(this.crateIds[i], amount);
      }
    });

    it("Invalid crate ID", async function () {
      const invalidId = 9999;
      const localcontract = await gameEntropySelector(this.f.nftinteractions, this.user);
      await syncTime();
      await expect(localcontract.openCrate(invalidId, 1)).to.be.revertedWith("G02");
    });

    it("Rewards not set", async function () {
      const noRewardsCrate = this.crateIds[2];
      const localcontract = await gameEntropySelector(this.f.nftinteractions, this.user);
      await syncTime();
      await expect(localcontract.openCrate(noRewardsCrate, 1)).to.be.revertedWith(
        "G03"
      );
    });

    it("Not enough crates", async function () {
      const amount = 9999;
      const localcontract = await gameEntropySelector(this.f.nftinteractions, this.user);
      await syncTime();
      await expect(localcontract.openCrate(this.crateIds[0], amount)).to.be.revertedWith(
        "G05"
      );
    });

    it("Successfuly opening a crate", async function () {
      const localcontract = await gameEntropySelector(this.f.nftinteractions, this.user);
      await syncTime();
      await localcontract.openCrate(this.crateIds[0], 1);
    });

    it("Crate balance after opnening crates", async function () {
      const bal = await this.f.nftgame.balanceOf(this.user.address, this.crateIds[0]);
      const amount = 2;
      const localcontract = await gameEntropySelector(this.f.nftinteractions, this.user);
      await syncTime();
      await localcontract.openCrate(this.crateIds[0], amount);

      expect(await this.f.nftgame.balanceOf(this.user.address, this.crateIds[0])).to.be.equal(
        bal.sub(amount)
      );
    });
  });
});
