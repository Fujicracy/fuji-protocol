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
    dydx = _fixture.dydx;
    debtToken = _fixture.debtToken;
    aave = _fixture.aave;

    await vault.setActiveProvider(dydx.address);

    //Users 1 and 2 are whitelisted before every test
    await advanceblocks(50);
    await vault.connect(users[1]).addmetowhitelist();
    await advanceblocks(50);
    await vault.connect(users[2]).addmetowhitelist();

  });

  describe("Alpha DYDX Basic Functionality", () => {

    it("User 1: deposits 1 ETH, checks @DYDXsolo by Vault deposit balance Ok", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      let vaultdepositsbal = await vault.connect(users[1]).depositBalance(dydx.address);
      await expect(vaultdepositsbal/1).to.be.closeTo(ONE_ETH/1, 100);

    });

    it("User 1 and 2: both deposit 1 ETH, checks @DYDX@solo by Vault deposit balance Ok", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      await vault.connect(users[2]).deposit(ONE_ETH, { value: ONE_ETH });
      let vaultdepositsbal = await vault.connect(users[1]).depositBalance(dydx.address);
      await expect(vaultdepositsbal/1).to.be.closeTo(ethers.utils.parseEther("2")/1, 2000000);

    });

    it("User 1: deposits 1 ETH and then withdraws 0.5 ETH", async () => {

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      await expect(await vault.connect(users[1]).withdraw(ethers.utils.parseEther("0.5")))
      .to.changeEtherBalance(users[1], ethers.utils.parseEther("0.5"));
      let vaultdepositsbal = await vault.connect(users[1]).depositBalance(dydx.address);
      await expect(vaultdepositsbal/1).to.be.closeTo(ethers.utils.parseEther("0.5")/1, 2000000);

    });

    it("User 1: deposits 1 ETH and borrows 1000 dai, check user dai balance", async () => {

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
