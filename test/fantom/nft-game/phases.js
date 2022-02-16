const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { BigNumber, provider } = ethers;

const { fixture } = require("../utils");

const { quickFixture, ASSETS, VAULTS } = require("./quick_test_fixture");

const {
  parseUnits,
  formatUnitsToNum,
  evmSnapshot,
  evmRevert,
  timeTravel,
} = require("../../helpers");

const FULL_FIXTURE = false;

if (FULL_FIXTURE) {
  const { ASSETS, VAULTS } = require("../utils");
} else {
  const { ASSETS, VAULTS } = require("./quick_test_fixture");
}

// ACTIONS TO TEST FOR EACH PHASE
// Points Accumulation | Crate Buying | Crate Opening | Locking | Crate Trading | NFT Card Trading

describe("NFT Bond Logic", function () {
  before(async function () {
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

  // beforeEach(async function () {
  //   if (this.evmSnapshot1) await evmRevert(this.evmSnapshot1);

  //   this.evmSnapshot1 = await evmSnapshot();
  // });

  // after(async function () {
  //   evmRevert(this.evmSnapshot0);
  // });

  describe("Before Game Start", function () {
    it("Should return 0, when calling nftGame.whatPhase()", async function() {
      expect(await this.f.nftgame.whatPhase()).to.eq(0);
    });

    it("No Points Accumulation", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(2500);
      const borrowAmount = parseUnits(250);
      const time = 60 * 60 * 24 * 5; // 5 days

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      await timeTravel(time);
      await vault.updateF1155Balances();

      expect(await this.f.nftgame.balanceOf(this.user.address, 0)).to.be.equal(0);
    });

    it("Should revert if trying to buy crates", async function () {
      expect(this.f.nftinteractions.connect(this.user).getCrates(this.crateIds[0], 1))
      .to.be.revertedWith("wrong game phase!");
    });
  });

  describe("After Accumulation Phase start", function () {

    before(async function() {
      const time = 60 * 60 * 24 * 3; // 3 more days since last time travel
      await timeTravel(time);
    });

    it("Should return 1, when calling nftGame.whatPhase()", async function() {
      await expect(await this.f.nftgame.whatPhase()).to.eq(1);
    });

    it("Should return zero, when calling nftgame.balanceOf()", async function () {
      const userData = await this.f.nftgame.userdata(this.user.address);
      const pointsBalance = await this.f.nftgame.balanceOf(this.user.address, 0);
      expect(userData.accruedPoints).to.eq(0);
      expect(pointsBalance).to.eq(0);
    });

    it("Should have some points accumulated", async function () {
      const vault = this.f.vaultftmdai;
      const borrowAmount = parseUnits(250);

      await vault.connect(this.user).borrow(borrowAmount);
      const time = 60 * 60 * 24 * 2; // 2 more days since last time travel
      await timeTravel(time);

      expect(await this.f.nftgame.balanceOf(this.user.address, 0)).to.be.gt(0);
    });

    it("Should allow to buy crates", async function () {
      await this.f.nftinteractions.connect(this.user).getCrates(this.crateIds[0], 2);
      await this.f.nftinteractions.connect(this.user).getCrates(this.crateIds[1], 2);
      await this.f.nftinteractions.connect(this.user).getCrates(this.crateIds[2], 2);

      expect(await this.f.nftgame.balanceOf(this.user.address, this.crateIds[0])).to.eq(2);
      expect(await this.f.nftgame.balanceOf(this.user.address, this.crateIds[1])).to.eq(2);
      expect(await this.f.nftgame.balanceOf(this.user.address, this.crateIds[2])).to.eq(2);
    });

    it("Should allow to transfer crates", async function () {
      await this.f.nftgame.connect(this.user).safeTransferFrom(
        this.user.address,
        this.otherUser.address,
        this.crateIds[0],
        1,
        []
      );
      expect(await this.f.nftgame.balanceOf(this.otherUser.address, this.crateIds[0])).to.eq(1);
    });
  });


});
