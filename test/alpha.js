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

//use(solidity);

describe("Alpha", () => {
  let dai;
  let aweth;
  let ceth;

  let fliquidator;
  let flasher;
  let controller;

  let aave;
  let compound;
  let dydx;

  let vault;
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
    aweth = _fixture.aweth;
    debtToken = _fixture.debtToken;
    aave = _fixture.aave;

    await vault.setActiveProvider(aave.address);

  });

  describe("VaultETHDAI -> Aave", () => {

    it("User 1 deposits 1 ETH and borrows 900 DAI", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });

      // Vault balance
      expect(await aweth.balanceOf(vault.address)).to.equal(ONE_ETH);

      const daiAmount = await convertToCurrencyDecimals(DAI_ADDR, 400);

      await expect(() => vault.connect(users[1]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[1], daiAmount);

      expect(await debtToken.balanceOf(users[1].address)).to.equal(daiAmount);

      // debt tokens appreciate after another tx
      const newDaiAmount = await convertToCurrencyDecimals(DAI_ADDR, 500);
      await vault.connect(users[1]).borrow(newDaiAmount);
      const balance = await debtToken.balanceOf(users[1].address);
      //console.log(balance.toString());
      expect(balance).to.gt(daiAmount);
    });

    it("User 2 deposits 1 ETH and borrows 900 DAI", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      await vault.connect(users[2]).deposit(ONE_ETH, { value: ONE_ETH });

      const daiAmount = await convertToCurrencyDecimals(DAI_ADDR, 900);
      await expect(() => vault.connect(users[1]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[1], daiAmount);
      await expect(() => vault.connect(users[2]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[2], daiAmount);

      const balance1 = await debtToken.balanceOf(users[1].address);
      console.log("User 1 debt balance: " + balance1.toString());
      const balance2 = await debtToken.balanceOf(users[2].address);
      console.log("User 2 debt balance: " + balance2.toString());

      // user1 accumulates more debt than user2
      expect(balance1).to.gt(balance2);
    });

  });
});
