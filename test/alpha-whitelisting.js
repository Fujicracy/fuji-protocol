const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { fixture, evmSnapshot, evmRevert } = require("./utils-alpha");

// use(solidity);

describe("Alpha", () => {
  let aave;
  let vaultdai;
  let vaultusdc;
  let vaultusdt;

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
    aave = theFixture.aave;
    vaultdai = theFixture.vaultdai;
    vaultusdc = theFixture.vaultusdc;
    vaultusdt = theFixture.vaultusdt;

    await vaultdai.setActiveProvider(aave.address);
    await vaultusdc.setActiveProvider(aave.address);
    await vaultusdt.setActiveProvider(aave.address);
  });

  describe("Alpha Whitelisting Functionality", () => {
    it("1.- Set limit users to 4, Users[1,2,3,4] added to whitelist, then users[5] tries deposit and reverts", async () => {
      // Bootstrap Liquidity (1st User)
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set up
      const depositETHAmount = ethers.utils.parseEther("12");

      // First 3 other users deposit
      for (let i = 1; i < 4; i++) {
        await vaultdai.connect(users[i]).deposit(depositETHAmount, { value: depositETHAmount });
      }

      // The fifth user should revert
      await expect(
        vaultdai.connect(users[10]).deposit(depositETHAmount, { value: depositETHAmount })
      ).to.be.revertedWith("901");
    });

    it("2.- Set ETH_CAP_VALUE to 2 eth, and Users[2] tries to deposit 4 ETH, and then 1 ETH and reverts ", async () => {
      // Bootstrap Liquidity (1st User)
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set up
      const theUser = users[11];
      const depositETHAmount1 = ethers.utils.parseEther("2");
      const depositETHAmount2 = ethers.utils.parseEther("2.01");

      // First Deposit
      await vaultdai.connect(theUser).deposit(depositETHAmount1, { value: depositETHAmount1 });

      // The fifth user should revert
      await expect(
        vaultdai.connect(theUser).deposit(depositETHAmount2, { value: depositETHAmount2 })
      ).to.be.revertedWith("901");
    });
  });
});
