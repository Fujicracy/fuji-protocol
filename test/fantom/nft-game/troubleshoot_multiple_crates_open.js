const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { WrapperBuilder } = require("redstone-evm-connector");

const { BigNumber, provider } = ethers;

const { fixture } = require("../utils");

const { quickFixture, ASSETS, VAULTS } = require("./quick_test_fixture");

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
  const { ASSETS, VAULTS } = require("./quick_test_fixture");
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const amountOfCratesToBuy = 10;

describe("Troubleshooting Opening Multiple Crates Tests", function () {
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

    /// Specific testing conditions.

    // Override game-phases and stay in accumulation phase.
    const now = (await provider.getBlock("latest")).timestamp;
    const quicktimeGap = 5; // 5 seconds
    const week = 60 * 60 * 24 * 7;
    const phases = [
      now,
      now + quicktimeGap,
      now + 52 * week,
      now + 53 * week
    ];
    await this.f.nftgame.setGamePhases(phases);

    // Force mint points for 'user'
    await this.f.nftgame.mint(this.user.address, 0, parseUnits(200,5));

    // Mint 10 crates of each type
    const cratesIdsArray = this.f.crateIds;
    for (let index = 0; index < cratesIdsArray.length; index++) {
      await this.f.nftinteractions.connect(this.user).mintCrates(cratesIdsArray[index], amountOfCratesToBuy);
    }

    // This condition is for testing only, allowing time travel and using redstone entropy feed.
    await this.f.nftinteractions.setMaxEntropyDelay(60 * 60 * 24 * 365 * 2);

    this.evmSnapshot0 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("Opening multiple crates", function () {

    it("Should open multiple crates with time delay", async function () {
      const timedelay = 5000; // miliseconds

      const wrappednftinteractions = WrapperBuilder
        .wrapLite(this.f.nftinteractions.connect(this.user))
        .usingPriceFeed("redstone", { asset: "ENTROPY" });
      
      const cratesIdsArray = this.f.crateIds;
      
      const logOpenedCrate = function (index, number) {
        console.log("\t"+`Open CreateID ${index+1}, # ${number+1}`);
      }
      for (let j = 0; j < cratesIdsArray.length; j++) {
        for (let i = 0; i < 10; i++) {
          await delay(timedelay);
          logOpenedCrate(j,i);
          await wrappednftinteractions.openCrate(cratesIdsArray[j], 1);
        }
      }
      for (let j = 0; j < cratesIdsArray.length; j++) {
        await expect(await this.f.nftgame.balanceOf(this.user.address, this.f.crateIds[j])).to.eq(0);
      }
    });
  });
});
