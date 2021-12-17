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
    this.executor = this.users[9];

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

  describe("Admin functions of Controller", function () {
    describe("Testing executor roles", function () {
      it("Set correctly role of executor", async function () {
        expect(await this.f.controller.isExecutor(this.executor.address)).to.equal(false);
        await this.f.controller.connect(this.users[0]).setExecutors([this.executor.address], true);
        expect(await this.f.controller.isExecutor(this.executor.address)).to.equal(true);
      });
    });

    describe("Testing ownership transfer", function () {
      it("Revert: User tricks to have ownership of the contract", async function () {
        await expect(
          this.f.controller.connect(this.user).transferOwnership(this.user.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Success: Owner tries to transfer ownership to new Owner", async function () {
        expect(await this.f.controller.pendingOwner()).to.be.equal(ZERO_ADDR);

        await this.f.controller.connect(this.owner).transferOwnership(this.newOwner.address);

        expect(await this.f.controller.pendingOwner()).to.be.equal(this.newOwner.address);

        await expect(this.f.controller.connect(this.owner).transferOwnership(this.newOwner.address))
          .to.be.reverted;
      });

      it("Revert: User tries to claim ownership", async function () {
        await expect(this.f.controller.connect(this.user).claimOwnership()).to.be.reverted;
      });

      it("Success: New owner tries to claim ownership", async function () {
        await this.f.controller.connect(this.owner).transferOwnership(this.newOwner.address);

        expect(await this.f.controller.pendingOwner()).to.be.equal(this.newOwner.address);
        expect(await this.f.controller.owner()).to.be.equal(this.owner.address);

        await this.f.controller.connect(this.newOwner).claimOwnership();

        expect(await this.f.controller.pendingOwner()).to.be.equal(ZERO_ADDR);
        expect(await this.f.controller.owner()).to.be.equal(this.newOwner.address);
      });

      it("Revert: user tries to call cancelTransferOwnership", async function () {
        await expect(
          this.f.controller.connect(this.user).cancelTransferOwnership()
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Revert: New owner tries to call cancelTransferOwnership before calling transferOwnership", async function () {
        await expect(this.f.controller.connect(this.owner).cancelTransferOwnership()).to.be
          .reverted;
      });

      it("Success: New owner tries to call cancelTransferOwnership after calling transferOwnership", async function () {
        expect(await this.f.controller.pendingOwner()).to.be.equal(ZERO_ADDR);

        await this.f.controller.connect(this.owner).transferOwnership(this.newOwner.address);

        expect(await this.f.controller.pendingOwner()).to.be.equal(this.newOwner.address);

        await this.f.controller.connect(this.owner).cancelTransferOwnership();

        expect(await this.f.controller.pendingOwner()).to.be.equal(ZERO_ADDR);
      });
    });

    describe("Refinancing to a new provider", function () {
      it("Success: Changing to new provider within vault's providers", async function () {
        const providers = [this.f.aave.address, this.f.ironBank.address];
        const vault = this.f.vaultethdai;

        await vault.connect(this.owner).setProviders(providers);

        await vault.setActiveProvider(providers[0]);

        await vault.depositAndBorrow(parseUnits(10), parseUnits(20), { value: parseUnits(10) });

        await this.f.controller.connect(this.owner).doRefinancing(vault.address, providers[1], 0);

        expect(await vault.activeProvider()).to.be.equal(providers[1]);
      });

      it("Revert: Changing to new provider not within vault's providers", async function () {
        const providers = [this.f.aave.address, this.f.ironBank.address];
        const vault = this.f.vaultethdai;
        const invalidProvider = this.f.compound.address;

        await vault.connect(this.owner).setProviders(providers);

        await vault.setActiveProvider(providers[0]);

        await vault.depositAndBorrow(parseUnits(10), parseUnits(20), { value: parseUnits(10) });

        await expect(
          this.f.controller.connect(this.owner).doRefinancing(vault.address, invalidProvider, 0)
        ).to.be.reverted;
      });
    });
  });
});
