const { ethers } = require("hardhat");
const { expect } = require("chai");
const { solidity, createFixtureLoader } = require("ethereum-waffle");

const {
  fixture,
  convertToCurrencyDecimals,
  convertToWei,
  evmSnapshot,
  evmRevert,
  DAI_ADDR,
  ONE_ETH,
} = require("./utils.js");

describe("Fuji", () => {
  let controller;
  let flasher;
  let vault;
  let aave;
  let compound;

  let dai;
  let aweth;
  let ceth;
  let debtToken;
  let users;

  let loadFixture;
  let evmSnapshotId;

  before(async() => {
    users = await ethers.getSigners();
    loadFixture = createFixtureLoader(users, ethers.provider);

    evmSnapshotId = await evmSnapshot();
  });

  after(async() => {
    evmRevert(evmSnapshotId);
  });

  beforeEach(async() => {
    const _fixture = await loadFixture(fixture);
    dai = _fixture.dai;
    vault = _fixture.vault;
    aave = _fixture.aave;
    compound = _fixture.compound;
    ceth = _fixture.ceth;
    controller = _fixture.controller;

    const rateCompound = await compound.getBorrowRateFor(DAI_ADDR);
    const rateAave = await aave.getBorrowRateFor(DAI_ADDR);

    if (rateAave.gt(rateCompound)) {
      await vault.setActiveProvider(aave.address);
    }
    else {
      await vault.setActiveProvider(compound.address);
    }
  });

  describe("Flashloan and Switch", () => {

    it("Should initiate a flashloan", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      await vault.connect(users[2]).deposit(ONE_ETH, { value: ONE_ETH });

      const daiAmount = await convertToCurrencyDecimals(DAI_ADDR, 700);

      await expect(() => vault.connect(users[1]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[1], daiAmount);
      await expect(() => vault.connect(users[2]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[2], daiAmount);

      await controller.doControllerRoutine(vault.address);

      const rate = await ceth.exchangeRateStored();
      const cethAmount = ONE_ETH.pow(2).div(rate);
      expect(await ceth.balanceOf(vault.address)).to.gte(cethAmount.mul(2));
    });

  });

});
