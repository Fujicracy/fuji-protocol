const { ethers } = require("hardhat");
const { expect } = require("chai");
const { solidity, createFixtureLoader } = require("ethereum-waffle");

const {
  fixture,
  convertToCurrencyDecimals,
  convertToWei,
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

  before(async() => {
    users = await ethers.getSigners();
    loadFixture = createFixtureLoader(users, ethers.provider);
  });

  describe("VaultETHDAI -> Compound", () => {

    it("User 3 deposits 1 ETH and borrows 2 * 400 DAI", async () => {
      const { dai, vault, ceth, debtToken } = await loadFixture(fixture);

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

    it("User 4 deposits 1 ETH, borrows 800 DAI and self-liquidates", async () => {
      const { dai, vault, debtToken } = await loadFixture(fixture);

      await vault.connect(users[4]).deposit(ONE_ETH, { value: ONE_ETH });

      const daiAmount = await convertToCurrencyDecimals(DAI_ADDR, 800);

      await expect(() => vault.connect(users[4]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[4], daiAmount);

      expect(await debtToken.balanceOf(users[4].address)).to.equal(daiAmount);

      const balanceBefore = await ethers.provider.getBalance(users[4].address);
      await vault.connect(users[4]).flashCloseTotal();
      const balanceAfter = await ethers.provider.getBalance(users[4].address);

      expect(balanceAfter).to.gt(balanceBefore);
      expect(await dai.balanceOf(users[4].address)).to.equal(daiAmount);

      expect(await debtToken.balanceOf(users[4].address)).to.equal(0);
    });

  });

});
