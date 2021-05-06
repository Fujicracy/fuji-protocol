const { ethers } = require("hardhat");
const { expect } = require("chai");
const { solidity, createFixtureLoader } = require("ethereum-waffle");

const {
  fixture,
  convertToCurrencyDecimals,
  advanceblocks,
  convertToWei,
  evmSnapshot,
  evmRevert,
  DAI_ADDR,
  USDC_ADDR,
  USDT_ADDR,
  ONE_ETH
} = require("./utils-alpha.js");

//use(solidity);

describe("Alpha", () => {

  let dai;
  let usdc;
  let usdt;
  let aweth;
  let ceth;
  let oracle;
  let treasury;
  let fujiadmin;
  let fliquidator;
  let flasher;
  let controller;
  let f1155;
  let aave;
  let compound;
  let dydx;
  let aWhitelist;
  let vaultdai;
  let vaultusdc;
  let vaultusdt;

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
    usdc = _fixture.usdc;
    usdt = _fixture.usdt;
    aweth = _fixture.aweth;
    ceth = _fixture.ceth;
    oracle = _fixture.oracle;
    treasury = _fixture.treasury;
    fujiadmin = _fixture.fujiadmin;
    fliquidator = _fixture.fliquidator;
    flasher = _fixture.flasher;
    controller = _fixture.controller;
    f1155 = _fixture.f1155;
    aave = _fixture.aave;
    compound = _fixture.compound;
    dydx = _fixture.dydx;
    aWhitelist = _fixture.aWhitelist;
    vaultdai = _fixture.vaultdai;
    vaultusdc = _fixture.vaultusdc;
    vaultusdt = _fixture.vaultusdt;

    await vaultdai.setActiveProvider(aave.address);
    await vaultusdc.setActiveProvider(aave.address);
    await vaultusdt.setActiveProvider(aave.address);

  });

  describe("Alpha Whitelisting Functionality", () => {

    it("1.- Set limit users to 5, Users[0,1,2,3,4] added to whitelist, then users[5] tries deposit and reverts", async () => {

      // Set up Limit of users to 5. This is only staged for purposes of testing.
      await aWhitelist.connect(users[0]).updateLimitUser(5);

      //Bootstrap Liquidity (1st User)
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      // Set up
      let depositETHAmount = ethers.utils.parseEther ("5");

      // First 3 other users deposit
      for (var i = 1; i < 4; i++) {
        await vaultdai.connect(users[i]).deposit(depositETHAmount,{value:depositETHAmount});
      }

      // The fifth user should revert
      await expect(vaultdai.connect(users[10]).deposit(depositETHAmount,{value:depositETHAmount})).to.be.revertedWith('901');

    });

    it("2.- Set ETH_CAP_VALUE to 2 eth, and Users[2] tries to deposit 4 ETH, and then 1 ETH and reverts ", async () => {

      // Set up Limit of users to 5. This is only staged for purposes of testing.
      await aWhitelist.connect(users[0]).updateCap(ethers.utils.parseEther("2"));

      //Bootstrap Liquidity (1st User)
      let bootstraper = users[0];
      let bstrapLiquidity = ethers.utils.parseEther("1");
      await vaultdai.connect(bootstraper).deposit(bstrapLiquidity,{ value: bstrapLiquidity });

      // Set up
      let theuser = users[11];
      let depositETHAmount_1 = ethers.utils.parseEther ("2");
      let depositETHAmount_2 = ethers.utils.parseEther ("2.01");

      // First Deposit
      await vaultdai.connect(theuser).deposit(depositETHAmount_1,{value:depositETHAmount_1});

      // The fifth user should revert
      await expect(vaultdai.connect(theuser).deposit(depositETHAmount_2,{value:depositETHAmount_2})).to.be.revertedWith('901');

    });


  });
});
