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
  ETH_ADDR,
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
  let vaultharvester;
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
    vaultharvester = _fixture.vaultharvester;
    vaultdai = _fixture.vaultdai;
    vaultusdc = _fixture.vaultusdc;
    vaultusdt = _fixture.vaultusdt;

  });

  describe("Alpha Vaults Extended Functionalities", () => {
    /*

    it("1.- getLiquidationBonusFor, vaultdai inputs 100 Amount, checks computation", async () => {

      let inputAmount = ethers.utils.parseUnits("100",18);
      let thevault = vaultdai;

      // Vault Computation
      let responseNormalLiq = await thevault.getLiquidationBonusFor(inputAmount, false);
      let responseFlashLiq = await thevault.getLiquidationBonusFor(inputAmount, true);

      // Manual Computation
      let bonusLfactor = await fujiadmin.bonusL();
      let bonusFlashLfactor = await fujiadmin.bonusFlashL();
      bonusLfactor = 1/(bonusLfactor[1]);
      bonusFlashLfactor = 1/(bonusFlashLfactor[1]);
      let computedrNormalLiq = inputAmount*bonusLfactor;
      let computedrFlashLiq = inputAmount*bonusFlashLfactor;

      await expect(responseNormalLiq/1).to.equal(computedrNormalLiq);
      await expect(responseFlashLiq/1).to.equal(computedrFlashLiq);

    });

    it("2.- getLiquidationBonusFor, vaultusdc inputs 50 Amount, checks computation", async () => {

      let inputAmount = ethers.utils.parseUnits("50",6);
      let thevault = vaultusdc;

      // Vault Computation
      let responseNormalLiq = await thevault.getLiquidationBonusFor(inputAmount, false);
      let responseFlashLiq = await thevault.getLiquidationBonusFor(inputAmount, true);

      // Manual Computation
      let bonusLfactor = await fujiadmin.bonusL();
      let bonusFlashLfactor = await fujiadmin.bonusFlashL();
      bonusLfactor = 1/(bonusLfactor[1]);
      bonusFlashLfactor = 1/(bonusFlashLfactor[1]);
      let computedrNormalLiq = inputAmount*bonusLfactor;
      let computedrFlashLiq = inputAmount*bonusFlashLfactor;

      await expect(responseNormalLiq/1).to.equal(computedrNormalLiq);
      await expect(responseFlashLiq/1).to.equal(computedrFlashLiq);

    });

    it("3.- getNeededCollateralFor, vaultdai inputs 5000 Amount, checks computation", async () => {

      let inputAmount = ethers.utils.parseUnits("5000",18);
      let thevault = vaultdai;

      // Vault Computation
      let collatNeeded = await thevault.getNeededCollateralFor(inputAmount, false);
      let collatNeededwFactor = await thevault.getNeededCollateralFor(inputAmount, true);
      //console.log(collatNeeded/1, collatNeededwFactor/1);

      // Manual Computation
      let collatF = await thevault.collatF();
      let safetyF = await thevault.safetyF();
      collatF = collatF[0]/collatF[1];
      safetyF = safetyF[0]/safetyF[1];
      let price = await oracle.latestRoundData();
      price = (price.answer)/1e18;
      //console.log(collatF, safetyF, price);
      let computedcollatNeeded = inputAmount*price;
      let computedcollatNeededwFactor = inputAmount*price*collatF*safetyF;
      //console.log(computedcollatNeeded,computedcollatNeededwFactor );

      await expect(collatNeeded/1).to.equal(computedcollatNeeded);
      await expect(collatNeededwFactor/1).to.equal(computedcollatNeededwFactor);

    });

    it("4.- getNeededCollateralFor, vaultusdt inputs 7000 Amount, checks computation", async () => {

      let inputAmount = ethers.utils.parseUnits("7000",6);
      let thevault = vaultusdt;

      // Vault Computation
      let collatNeeded = await thevault.getNeededCollateralFor(inputAmount, false);
      let collatNeededwFactor = await thevault.getNeededCollateralFor(inputAmount, true);
      //console.log(collatNeeded/1, collatNeededwFactor/1);

      // Manual Computation
      let collatF = await thevault.collatF();
      let safetyF = await thevault.safetyF();
      collatF = collatF[0]/collatF[1];
      safetyF = safetyF[0]/safetyF[1];
      let price = await oracle.latestRoundData();
      price = price.answer;
      //console.log(collatF, safetyF, price);
      let computedcollatNeeded = (inputAmount/1e6)*price;
      let computedcollatNeededwFactor = (inputAmount/1e6)*price*collatF*safetyF;
      //console.log(computedcollatNeeded,computedcollatNeededwFactor );

      await expect(collatNeeded/1).to.equal(computedcollatNeeded);
      await expect(collatNeededwFactor/1).to.equal(computedcollatNeededwFactor);

    });

    it("5.- harvesting COMP", async () => {

      let comptoken = await ethers.getContractAt("IERC20", "0xc00e94Cb662C3520282E6f5717214004A7f26888");

      // Set up variables
      let thevault = vaultdai;
      let user_X = users[11];
      let depositAmount = ethers.utils.parseEther("995");
      let borrowAmount = ethers.utils.parseUnits("100000",18);
      let smallDeposits = ethers.utils.parseEther("0.1");

      // For COMP set up compound as provider
      await thevault.setActiveProvider(compound.address);

      // Set up high Deposit Limit. This is only staged for purposes of testing.
      await aWhitelist.connect(users[0]).updateCap(ethers.utils.parseEther("1000"));

      // Do a deposit
      await thevault.connect(user_X).depositAndBorrow(depositAmount, borrowAmount, {value:depositAmount});

      // Do small deposits to updateState in Compound contracts in long time periods
      for (var i = 1; i < 11; i++) {
        await thevault.connect(users[i]).deposit(smallDeposits, {value:smallDeposits });
        await advanceblocks(50);
      }

      // Pass 0 for COMP farming
      await thevault.connect(users[0]).harvestRewards(0);

      await expect(await comptoken.balanceOf(treasury.address)).to.be.gt(0);

    });
    */

    it("6.- harvesting stkAave", async () => {

      let stkAavetoken = await ethers.getContractAt("IERC20", "0x4da27a545c0c5B758a6BA100e3a049001de870f5");

      // Set up variables
      let thevault = vaultdai;
      let user_X = users[12];
      let depositAmount = ethers.utils.parseEther("995");
      let borrowAmount = ethers.utils.parseUnits("100000",18);
      let smallDeposits = ethers.utils.parseEther("0.1");

      // For stkAave set up Aave as provider
      await thevault.setActiveProvider(aave.address);

      // Set up high Deposit Limit. This is only staged for purposes of testing.
      await aWhitelist.connect(users[0]).updateCap(ethers.utils.parseEther("1000"));

      // Do a deposit
      await thevault.connect(user_X).depositAndBorrow(depositAmount, borrowAmount, {value:depositAmount});

      // Do small deposits to updateState in Compound contracts in long time periods
      for (var i = 1; i < 11; i++) {
        await thevault.connect(users[i]).deposit(smallDeposits, {value:smallDeposits });
        await advanceblocks(50);
      }

      // Pass 1 for stkAave farming
      await thevault.connect(users[0]).harvestRewards(1);

      await expect(await stkAavetoken.balanceOf(treasury.address)).to.be.gt(0);

    });


  });
});
