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
    ceth = _fixture.ceth;
    debtToken = _fixture.debtToken;
    compound = _fixture.compound;

    await vault.setActiveProvider(compound.address);
  });

  describe("VaultETHDAI -> Compound", () => {

    it("User 3 deposits 1 ETH and borrows 2 * 400 DAI", async () => {

      await vault.connect(users[3]).deposit(ONE_ETH, { value: ONE_ETH });

      // Vault balance
      const rate = await ceth.exchangeRateStored();
      const cethAmount = ONE_ETH.pow(2).div(rate);
      expect(await ceth.balanceOf(vault.address)).to.equal(cethAmount);

      const daiAmount = await convertToCurrencyDecimals(DAI_ADDR, 400);

      await expect(() => vault.connect(users[3]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[3], daiAmount);

      expect(await debtToken.balanceOf(users[3].address)).to.equal(daiAmount);

      // debt tokens appreciate after another tx
      await vault.connect(users[3]).borrow(daiAmount)
      const balance = await debtToken.balanceOf(users[3].address);
      console.log("User 3 debt balance: " + balance.toString());
      expect(balance).to.gt(daiAmount.mul(2));
    });

  });

});
