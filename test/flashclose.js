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
    debtToken = _fixture.debtToken;

    //await vault.setActiveProvider(aave.address);
  });

  describe("Flash Close - Aave", () => {

    beforeEach(async() => {
      await vault.setActiveProvider(aave.address);
    });

    it("User 1 deposits 1 ETH, borrows 1000 DAI and flash-close", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });

      const daiAmount = await convertToCurrencyDecimals(DAI_ADDR, 700);

      await expect(() => vault.connect(users[1]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[1], daiAmount);

      expect(await debtToken.balanceOf(users[1].address)).to.equal(daiAmount);

      const balanceBefore = await ethers.provider.getBalance(users[1].address);
      await vault.connect(users[1]).flashCloseTotal();
      const balanceAfter = await ethers.provider.getBalance(users[1].address);

      expect(await dai.balanceOf(users[1].address)).to.equal(daiAmount);
      expect(balanceAfter).to.gt(balanceBefore);

      expect(await debtToken.balanceOf(users[1].address)).to.equal(0);

    });

  });

  describe("Flash Close - Compound", () => {

    beforeEach(async() => {
      await vault.setActiveProvider(compound.address);
    });

    it("User 2 deposits 1 ETH, borrows 800 DAI and self-liquidates", async () => {

      await vault.connect(users[2]).deposit(ONE_ETH, { value: ONE_ETH });

      const daiAmount = await convertToCurrencyDecimals(DAI_ADDR, 800);

      await expect(() => vault.connect(users[2]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[2], daiAmount);

      expect(await debtToken.balanceOf(users[2].address)).to.equal(daiAmount);

      const balanceBefore = await ethers.provider.getBalance(users[2].address);
      await vault.connect(users[2]).flashCloseTotal();
      const balanceAfter = await ethers.provider.getBalance(users[2].address);

      expect(balanceAfter).to.gt(balanceBefore);
      expect(await dai.balanceOf(users[2].address)).to.equal(daiAmount);

      expect(await debtToken.balanceOf(users[2].address)).to.equal(0);
    });

  });

});
