const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { WrapperBuilder } = require("redstone-evm-connector");

const { BigNumber, provider } = ethers;

const { fixture } = require("../utils");

const { quickFixture, ASSETS, VAULTS } = require("./fixtures/quick_test_fixture");

const {
  parseUnits,
  formatUnitsToNum,
  evmSnapshot,
  evmRevert,
  evmSetNextBlockTimestamp,
  timeTravel,
} = require("../../helpers");

const FULL_FIXTURE = false;
const DEBUG = true;

if (FULL_FIXTURE) {
  const { ASSETS, VAULTS } = require("../utils");
} else {
  const { ASSETS, VAULTS } = require("./fixtures/quick_test_fixture");
}

/**
 * @note Returns the etherjs contract according to oracle choice in NFTInteractions contract.
 * @param interactionContract Etherjs contract object representing 'NFTInteractions.sol'.
 * @param wallet Ethersjs wallet object.
 */
const gameEntropySelector = async function (interactionContract, wallet) {
  const bool = await interactionContract.isRedstoneOracleOn();
  const contract = !bool ? interactionContract.connect(wallet) : WrapperBuilder.wrapLite(interactionContract.connect(wallet))
    .usingPriceFeed("redstone", { asset: "ENTROPY" });
  return contract;
}

// ACTIONS TO TEST FOR EACH PHASE
// Points Accumulation | Crate Buying | Crate Opening | Locking | Crate Trading | NFT Card Trading

describe("NFT Bond Phase Tests", function () {
  
  before(async function () {
    console.log("\t" + "NOTE: all test are required to run in series.");
    this.users = await ethers.getSigners();

    this.admin = this.users[0];
    this.user = this.users[1];
    this.otherUser = this.users[2];

    const loadFixture = createFixtureLoader(this.users, provider);

    if (FULL_FIXTURE) {
      this.f = await loadFixture(fixture);
    } else {
      this.f = await loadFixture(quickFixture);
    }

    // This condition is for testing only, allowing time travel and using redstone entropy feed.
    await this.f.nftinteractions.setMaxEntropyDelay(60 * 60 * 24 * 365 * 2);

    this.evmSnapshot0 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("Before Game Start", function () {

    it("Should return 0, when calling nftGame.getPhase()", async function () {
      if (DEBUG) {
        console.log("\t" + "timestamp-0", (await provider.getBlock("latest")).timestamp);
      }
      await expect(await this.f.nftgame.getPhase()).to.eq(0);
    });

    it("No Points Accumulation", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(5000);
      const borrowAmount = parseUnits(75);
      const time = 60 * 60 * 24 * 6; // 6 days

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      await timeTravel(time);
      await vault.updateF1155Balances();

      await expect(await this.f.nftgame.balanceOf(this.user.address, 0)).to.be.equal(0);
    });

    it("Should revert if trying to buy crates", async function () {
      await expect(this.f.nftinteractions.connect(this.user).mintCrates(this.f.crateIds[0], 1))
        .to.be.revertedWith("G01");
    });

    it("Should revert if force mint cards", async function () {
      await expect(this.f.nftgame.mint(this.user.address, this.f.cardIds[0], 1))
        .to.be.revertedWith("G01");
    });

    it("Should revert if try to call 'lockFinalScore'", async function () {
      await expect(this.f.nftinteractions.connect(this.user).lockFinalScore()).to.be.revertedWith("G01");
    });
  });

  describe("Accumulation Phase (transfer/trading enabled)", function () {

    before(async function () {
      const time = 60 * 60 * 24 * 2; // 2 days fater last time travel
      await timeTravel(time);
    });

    it("Should return 1, when calling nftGame.getPhase()", async function () {
      if (DEBUG) {
        console.log("\t" + "timestamp-1", (await provider.getBlock("latest")).timestamp);
      }
      await expect(await this.f.nftgame.getPhase()).to.eq(1);
    });

    it("Should return zero, when calling nftgame.balanceOf()", async function () {
      const userData = await this.f.nftgame.userdata(this.user.address);
      const pointsBalance = await this.f.nftgame.balanceOf(this.user.address, 0);
      await expect(userData.accruedPoints).to.eq(0);
      await expect(pointsBalance).to.eq(0);
    });

    it("Should have some points accumulated", async function () {
      const vault = this.f.vaultftmdai;
      const borrowAmount = parseUnits(75);

      await vault.connect(this.user).borrow(borrowAmount);
      const time = 60 * 60 * 24 * 4; // 4 more days since last time travel
      await timeTravel(time);

      // Force minting debt to pretend interest accrued
      await this.f.f1155.mint(this.user.address, 1, parseUnits(5));
      await vault.updateF1155Balances();

      await expect(await this.f.nftgame.balanceOf(this.user.address, 0)).to.be.gt(0);
    });

    it("Should allow to buy crates", async function () {
      const cratesIdsArray = this.f.crateIds;
      for (let index = 0; index < cratesIdsArray.length; index++) {
        await this.f.nftinteractions.connect(this.user).mintCrates(cratesIdsArray[index], 3);
        await expect(await this.f.nftgame.balanceOf(this.user.address, cratesIdsArray[index])).to.eq(3);
      }
    });

    it("Should allow to transfer crates", async function () {
      await this.f.nftgame.connect(this.user).safeTransferFrom(
        this.user.address,
        this.otherUser.address,
        this.f.crateIds[0],
        2,
        []
      );
      await expect(await this.f.nftgame.balanceOf(this.otherUser.address, this.f.crateIds[0])).to.eq(2);
    });

    it("Should allow to open crates", async function () {
      const chosen_nftinteractions = await gameEntropySelector(this.f.nftinteractions, this.otherUser);
      await chosen_nftinteractions.openCrate(this.f.crateIds[0], 1);
      await expect(await this.f.nftgame.balanceOf(this.otherUser.address, this.f.crateIds[0])).to.eq(1);
    });

    it("Should be able to hold and transfer cards", async function () {
      // Admin will force mint NFT card
      await this.f.nftgame.mint(
        this.user.address,
        this.f.cardIds[0],
        2
      );
      await expect(await this.f.nftgame.balanceOf(this.user.address, this.f.cardIds[0])).to.eq(2);
      await this.f.nftgame.connect(this.user).safeTransferFrom(
        this.user.address,
        this.otherUser.address,
        this.f.cardIds[0],
        2,
        []
      );
      await expect(await this.f.nftgame.balanceOf(this.otherUser.address, this.f.cardIds[0])).to.be.gte(2);
    });

    it("Should revert if try to call 'lockFinalScore'", async function () {
      await expect(this.f.nftinteractions.connect(this.user).lockFinalScore()).to.be.revertedWith("G01");
    });
  });

  describe("Trading Phase (no more point accumulation, lock enabled, bonding enabled)", function () {
    before(async function () {
      const time = 60 * 60 * 24 * 3; // 3 days after the last times travel
      await timeTravel(time);
    });

    it("Should return 2, when calling nftGame.getPhase()", async function () {
      if (DEBUG) {
        console.log("\t" + "timestamp-2", (await provider.getBlock("latest")).timestamp);
      }
      await expect(await this.f.nftgame.getPhase()).to.eq(2);
    });

    it("Should not accumulate more points", async function () {
      const userPointsInitial = await this.f.nftgame.balanceOf(this.user.address, 0);
      const vault = this.f.vaultftmdai;
      const borrowAmount = parseUnits(75);
      await vault.connect(this.user).borrow(borrowAmount);
      const time = 60 * 60 * 24 * 4; // 4 more days since last time travel
      await timeTravel(time);

      // Force minting debt to pretend interest accrued
      await this.f.f1155.mint(this.user.address, 1, parseUnits(5));
      await vault.updateF1155Balances();

      const userPointsFwd = await this.f.nftgame.balanceOf(this.user.address, 0);
      await expect(userPointsInitial).to.eq(userPointsFwd);
    });

    it("Should allow to buy crates", async function () {
      const crateBalance = await this.f.nftgame.balanceOf(this.user.address, this.f.crateIds[0]);
      await this.f.nftinteractions.connect(this.user).mintCrates(this.f.crateIds[0], 1);
      await expect(await this.f.nftgame.balanceOf(this.user.address, this.f.crateIds[0])).to.gt(crateBalance);
    });

    it("Should allow to transfer crates", async function () {
      await this.f.nftgame.connect(this.user).safeTransferFrom(
        this.user.address,
        this.otherUser.address,
        this.f.crateIds[0],
        1,
        []
      );
      await expect(await this.f.nftgame.balanceOf(this.otherUser.address, this.f.crateIds[0])).to.eq(2);
    });

    it("Should allow to open crates", async function () {
      const chosen_nftinteractions = await gameEntropySelector(this.f.nftinteractions, this.otherUser);
      await chosen_nftinteractions.openCrate(this.f.crateIds[0], 1);
      await expect(await this.f.nftgame.balanceOf(this.otherUser.address, this.f.crateIds[0])).to.eq(1);
    });

    it("Should be able to hold and transfer cards", async function () {
      await expect(await this.f.nftgame.balanceOf(this.otherUser.address, this.f.cardIds[0])).to.be.gte(1);
      await this.f.nftgame.connect(this.otherUser).safeTransferFrom(
        this.otherUser.address,
        this.user.address,
        this.f.cardIds[0],
        1,
        []
      );
      await expect(await this.f.nftgame.balanceOf(this.user.address, this.f.cardIds[0])).to.be.gte(1);
    });

    it("Should lock user final FinalScore", async function () {
      const dummyAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
      // Dummy address set to allow functionality tests to run.
      await this.f.nftgame.setLockNFTDescriptor(dummyAddress);

      const cardIdsArray = this.f.cardIds;
      const cardPreLockBalance = [];
      for (let index = 0; index < cardIdsArray.length; index++) {
        cardPreLockBalance.push(await this.f.nftgame.balanceOf(this.user.address, cardIdsArray[index]));
      }

      await this.f.nftinteractions.connect(this.user).lockFinalScore();
      const userData = await this.f.nftgame.userdata(this.user.address);
      const lockNFTId = userData.lockedNFTID;
      await expect(lockNFTId).to.be.gt(0);

      const crateIdsArray = this.f.crateIds;
      for (let index = 0; index < crateIdsArray.length; index++) {
        await expect(await this.f.nftgame.balanceOf(this.user.address, crateIdsArray[index])).to.eq(0);
      }
      for (let index = 0; index < cardIdsArray.length; index++) {
        await expect(await this.f.nftgame.balanceOf(this.user.address, cardIdsArray[index])).to.eq(0);
      }
    });
  });

  describe("Locking Phase (no more trading)", function () {
    before(async function () {
      const time = 60 * 60 * 24 * 3; // 3 days after last time travel
      await timeTravel(time);
    });

    it("Should return 3, when calling nftGame.getPhase()", async function () {
      if (DEBUG) {
        console.log("\t" + "timestamp-3", (await provider.getBlock("latest")).timestamp);
      }
      await expect(await this.f.nftgame.getPhase()).to.eq(3);
    });

    it("Should not accumulate more points", async function () {
      const userPointsInitial = await this.f.nftgame.balanceOf(this.user.address, 0);
      const vault = this.f.vaultftmdai;
      const borrowAmount = parseUnits(75);
      await vault.connect(this.user).borrow(borrowAmount);
      const time = 60 * 60 * 24 * 4; // 4 more days since last time travel
      await timeTravel(time);

      // Force minting debt to pretend interest accrued
      await this.f.f1155.mint(this.user.address, 1, parseUnits(5));
      await vault.updateF1155Balances();

      const userPointsFwd = await this.f.nftgame.balanceOf(this.user.address, 0);
      await expect(userPointsInitial).to.eq(userPointsFwd);
    });

    it("Should revert if unlocked user tries to transfer crates", async function () {
      await expect(await this.f.nftgame.balanceOf(this.otherUser.address, this.f.crateIds[0])).to.be.gt(0);
      await expect(
        this.f.nftgame.connect(this.otherUser).safeTransferFrom(
          this.otherUser.address,
          this.user.address,
          this.f.crateIds[0],
          1,
          []
        )
      ).to.be.revertedWith("G06");
    });

    it("Should revert if unlocked user tries to transfer cards", async function () {
      await expect(await this.f.nftgame.balanceOf(this.otherUser.address, this.f.cardIds[0])).to.be.gt(0);
      await expect(
        this.f.nftgame.connect(this.otherUser).safeTransferFrom(
          this.otherUser.address,
          this.user.address,
          this.f.cardIds[0],
          1,
          []
        )
      ).to.be.revertedWith("G06");
    });

  });
});
