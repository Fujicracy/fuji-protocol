const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, ZERO_ADDR } = require("./helpers");

const { fixture } = require("./core-utils");

describe("Core Fuji Instance", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.owner = this.users[0];
    this.newOwner = this.users[1];
    this.user = this.users[2];

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

  console.warn("Skipping 10_vault_base_claimable ...");
  console.warn("Reason: it's not possible to change from Ownable to Claimable because it breaks the storage layout!");

  //describe("Admin functions of FujiVault", function () {
    //describe("Testing ownership transfer", function () {
      //it("Revert: User tricks to have ownership of the contract", async function () {
        //await expect(
          //this.f.vaultethdai.connect(this.user).transferOwnership(this.user.address)
        //).to.be.revertedWith("Ownable: caller is not the owner");
      //});

      //it("Success: Owner tries to transfer ownership to new Owner", async function () {
        //expect(await this.f.vaultethdai.pendingOwner()).to.be.equal(ZERO_ADDR);

        //await this.f.vaultethdai.connect(this.owner).transferOwnership(this.newOwner.address);

        //expect(await this.f.vaultethdai.pendingOwner()).to.be.equal(this.newOwner.address);

        //await expect(
          //this.f.vaultethdai.connect(this.owner).transferOwnership(this.newOwner.address)
        //).to.be.reverted;
      //});

      //it("Revert: User tries to claim ownership", async function () {
        //await expect(this.f.vaultethdai.connect(this.user).claimOwnership()).to.be.reverted;
      //});

      //it("Success: New owner tries to claim ownership", async function () {
        //await this.f.vaultethdai.connect(this.owner).transferOwnership(this.newOwner.address);

        //expect(await this.f.vaultethdai.pendingOwner()).to.be.equal(this.newOwner.address);
        //expect(await this.f.vaultethdai.owner()).to.be.equal(this.owner.address);

        //await this.f.vaultethdai.connect(this.newOwner).claimOwnership();

        //expect(await this.f.vaultethdai.pendingOwner()).to.be.equal(ZERO_ADDR);
        //expect(await this.f.vaultethdai.owner()).to.be.equal(this.newOwner.address);
      //});

      //it("Revert: user tries to call cancelTransferOwnership", async function () {
        //await expect(
          //this.f.vaultethdai.connect(this.user).cancelTransferOwnership()
        //).to.be.revertedWith("Ownable: caller is not the owner");
      //});

      //it("Revert: New owner tries to call cancelTransferOwnership before calling transferOwnership", async function () {
        //await expect(this.f.vaultethdai.connect(this.owner).cancelTransferOwnership()).to.be
          //.reverted;
      //});

      //it("Success: New owner tries to call cancelTransferOwnership after calling transferOwnership", async function () {
        //expect(await this.f.vaultethdai.pendingOwner()).to.be.equal(ZERO_ADDR);

        //await this.f.vaultethdai.connect(this.owner).transferOwnership(this.newOwner.address);

        //expect(await this.f.vaultethdai.pendingOwner()).to.be.equal(this.newOwner.address);

        //await this.f.vaultethdai.connect(this.owner).cancelTransferOwnership();

        //expect(await this.f.vaultethdai.pendingOwner()).to.be.equal(ZERO_ADDR);
      //});
    //});
  //});
});
