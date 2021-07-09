const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { fixture, evmSnapshot, evmRevert, TREASURY_ADDR } = require("./utils-alpha");

// use(solidity);

describe("Alpha", () => {
  let fujiadmin;
  let fliquidator;
  let flasher;
  let controller;
  let compound;
  let vaultdai;
  let vaultusdc;

  let users;

  let loadFixture;
  let evmSnapshotId;

  before(async () => {
    users = await ethers.getSigners();
    loadFixture = createFixtureLoader(users, ethers.provider);
    evmSnapshotId = await evmSnapshot();
  });

  after(async () => {
    evmRevert(evmSnapshotId);
  });

  beforeEach(async () => {
    const theFixture = await loadFixture(fixture);
    fujiadmin = theFixture.fujiadmin;
    fliquidator = theFixture.fliquidator;
    flasher = theFixture.flasher;
    controller = theFixture.controller;
    compound = theFixture.compound;
    vaultdai = theFixture.vaultdai;
    vaultusdc = theFixture.vaultusdc;

    await vaultdai.setActiveProvider(compound.address);
    await vaultusdc.setActiveProvider(compound.address);
  });

  describe("Alpha Compound Basic Functionality", () => {
    it("Testing the FujiAdmin", async () => {
      await expect(await fujiadmin.getFlasher()).to.equal(flasher.address);
      await expect(await fujiadmin.getFliquidator()).to.equal(fliquidator.address);
      await expect(await fujiadmin.getController()).to.equal(controller.address);
      await expect(await fujiadmin.getTreasury()).to.equal(TREASURY_ADDR);
    });
  });
});
