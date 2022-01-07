const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { fixture, ASSETS, VAULTS } = require("../utils");
const { parseUnits, evmSnapshot, evmRevert, FLASHLOAN } = require("../../helpers");

describe("Core Fuji Instance", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.owner = this.users[0];

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

  describe("NFT Bond Logic", function () {
    describe("Valid Vaults", function () {
      it("Set valid vaults", async function () {
        await expect(this.f.nftbondlogic.validVaults(0)).to.be.reverted;
        await this.f.nftbondlogic.setValidVaults([this.f.vaultftmdai.address]);
        expect(await this.f.nftbondlogic.validVaults(0)).to.be.equal(this.f.vaultftmdai.address);
      });
    });
  });
});
