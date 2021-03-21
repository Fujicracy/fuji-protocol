const { ethers, BigNumber } = require("hardhat");
const { expect } = require("chai");
const { solidity, createFixtureLoader } = require("ethereum-waffle");

const {
  fixture,
  convertToCurrencyDecimals,
  convertToWei,
  advanceblocks,
  evmSnapshot,
  evmRevert,
  DAI_ADDR,
  ONE_ETH,
  ETH_ADDR,
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
    ceth = _fixture.ceth;
    debtToken = _fixture.debtToken;
    compound = _fixture.compound;

    await vault.setActiveProvider(compound.address);

    //Users 1 and 2 are whitelisted before every test
    await advanceblocks(50);
    await vault.connect(users[1]).addmetowhitelist();
    await advanceblocks(50);
    await vault.connect(users[2]).addmetowhitelist();

  });

  describe("Alpha Compound Basic Functionality", () => {

    it("User 1: deposits 1 ETH, checks Vault has cETH balance Ok", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      let vaultbal = await ceth.balanceOf(vault.address);
      const rate = await ceth.exchangeRateStored();
      const cethAmount = (ethers.utils.parseEther("1.0")).pow(2).div(rate);
      await expect(vaultbal).to.equal(cethAmount);

    });

    it("User 1 and 2: both deposit 1 ETH, checks Vault has all cETH balance Ok", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      await vault.connect(users[2]).deposit(ONE_ETH, { value: ONE_ETH });
      const rate = await ceth.exchangeRateStored();
      const cethAmount = 2*(ethers.utils.parseEther("1.0")).pow(2).div(rate);
      let vaultbal = await ceth.balanceOf(vault.address);
      vaultbal = vaultbal/1;
      await expect(vaultbal).to.be.closeTo(cethAmount, 200);

    });

    it("User 1: deposits 1 ETH and then withdraws 0.5 ETH", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      await expect(await vault.connect(users[1]).withdraw(ethers.utils.parseEther("0.5")))
      .to.changeEtherBalance(users[1], ethers.utils.parseEther("0.5"));
    });

    it("User 1: deposits 1 ETH and borrows 1000 dai", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      await vault.connect(users[1]).borrow(ethers.utils.parseEther("1000"));
      await expect(await dai.balanceOf(users[1].address))
      .to.equal(ethers.utils.parseEther("1000"));
    });

    it("User 2: deposits 1 ETH, borrows 1000 dai, then paybacks 125 dai", async () => {

      await vault.connect(users[2]).deposit(ONE_ETH, { value: ONE_ETH });
      await vault.connect(users[2]).borrow(ethers.utils.parseEther("1000"));
      await dai.connect(users[2]).approve(vault.address, ethers.utils.parseEther("125"));
      await vault.connect(users[2]).payback(ethers.utils.parseEther("125"));
      await expect(await dai.balanceOf(users[2].address))
      .to.equal(ethers.utils.parseEther("875"));
    });




  });
});
