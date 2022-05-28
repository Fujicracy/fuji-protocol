const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { BigNumber, provider } = ethers;

const { quickFixture, ASSETS, VAULTS } = require("./fixtures/quick_test_fixture");
const {
  parseUnits,
  formatUnitsToNum,
  evmSnapshot,
  evmRevert,
  timeTravel,
} = require("../../helpers");

describe("NFT Bond Logic", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.admin = this.users[0];
    this.user = this.users[1];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(quickFixture);

    this.evmSnapshot0 = await evmSnapshot();
  });

  beforeEach(async function () {
    if (this.evmSnapshot1) await evmRevert(this.evmSnapshot1);

    this.evmSnapshot1 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("NFT Game", function () {
    it("Set valid vaults", async function () {
      await expect(this.f.nftgame.connect(this.user).setValidVaults([])).to.be.revertedWith("G00");
    });

    it("Set game phases", async function () {
      await expect(
        this.f.nftgame.connect(this.user).setGamePhases([0, 1, 2, 3])
      ).to.be.revertedWith("G00");
    });

    it("Reverting state of points outside contract", async function () {
      await expect(
        this.f.nftgame.connect(this.admin).checkStateOfPoints(this.user.address, 0, true)
      ).to.be.reverted;
    });

    it("Mint", async function () {
      await expect(
        this.f.nftgame.connect(this.user).mint(this.user.address, 0, 1)
      ).to.be.revertedWith("G00");
    });

    it("Burn", async function () {
      await expect(
        this.f.nftgame.connect(this.user).burn(this.user.address, 0, 1)
      ).to.be.revertedWith("G00");
    });

    it("Set merkle root", async function () {
      const zeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
      await expect(this.f.nftgame.connect(this.user).setMerkleRoot(zeroBytes32)).to.be.revertedWith(
        "G00"
      );
    });
  });

  describe("NFT Interactions", function () {
    it("Set NFT Game", async function () {
      await expect(
        this.f.nftinteractions.connect(this.user).setNFTGame(this.f.nftgame.address)
      ).to.be.revertedWith("G00");
    });

    it("Set crate prices", async function () {
      await expect(
        this.f.nftinteractions.connect(this.user).setCratePrice(0, 0)
      ).to.be.revertedWith("G00");
    });

    it("Set probability intervals", async function () {
      await expect(
        this.f.nftinteractions.connect(this.user).setProbabilityIntervals([])
      ).to.be.revertedWith("G00");
    });

    it("Set crate rewards", async function () {
      await expect(
        this.f.nftinteractions.connect(this.user).setCrateRewards(0, [])
      ).to.be.revertedWith("G00");
    });
  });
});
