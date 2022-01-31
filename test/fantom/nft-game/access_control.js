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

describe("NFT Bond Logic", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.admin = this.users[0];
    this.user = this.users[1];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(fixture);

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
      await expect(this.f.nftgame.connect(this.user).setValidVaults([])).to.be.revertedWith(
        "No permission"
      );
    });

    it("Reverting state of points outside contract", async function () {
      await expect(
        this.f.nftgame.connect(this.admin).checkStateOfPoints(this.user.address, 0, true)
      ).to.be.reverted;
    });

    it("Mint", async function () {
      await expect(
        this.f.nftgame.connect(this.admin).mint(this.user.address, 0, 1)
      ).to.be.revertedWith("No permission");
    });

    it("Burn", async function () {
      await expect(
        this.f.nftgame.connect(this.admin).burn(this.user.address, 0, 1)
      ).to.be.revertedWith("No permission");
    });

    it("Set merkle root", async function () {
      const zeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
      await expect(this.f.nftgame.connect(this.user).setMerkleRoot(zeroBytes32)).to.be.revertedWith(
        "No permission"
      );
    });
  });
});
