const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { fixture, evmSnapshot, evmRevert, advanceblocks, TREASURY_ADDR } = require("./utils-alpha");

// use(solidity);

describe("Alpha", () => {
  let oracle;
  let fujiadmin;
  let aave;
  let compound;
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
    oracle = theFixture.oracle;
    fujiadmin = theFixture.fujiadmin;
    aave = theFixture.aave;
    compound = theFixture.compound;
    vaultdai = theFixture.vaultdai;
    vaultusdc = theFixture.vaultusdc;
    vaultusdt = theFixture.vaultusdt;
  });

  describe("Alpha Vaults Extended Functionalities", () => {
    it("1.- getLiquidationBonusFor, vaultdai inputs 100 Amount, checks computation", async () => {
      const inputAmount = ethers.utils.parseUnits("100", 18);
      const thevault = vaultdai;

      // Vault Computation
      const responseNormalLiq = await thevault.getLiquidationBonusFor(inputAmount, false);
      const responseFlashLiq = await thevault.getLiquidationBonusFor(inputAmount, true);

      // Manual Computation
      let bonusLfactor = await fujiadmin.bonusL();
      let bonusFlashLfactor = await fujiadmin.bonusFlashL();
      bonusLfactor = 1 / bonusLfactor[1];
      bonusFlashLfactor = 1 / bonusFlashLfactor[1];

      const computedrNormalLiq = inputAmount * bonusLfactor;
      const computedrFlashLiq = inputAmount * bonusFlashLfactor;

      await expect(responseNormalLiq / 1).to.equal(computedrNormalLiq);
      await expect(responseFlashLiq / 1).to.equal(computedrFlashLiq);
    });

    it("2.- getLiquidationBonusFor, vaultusdc inputs 50 Amount, checks computation", async () => {
      const inputAmount = ethers.utils.parseUnits("50", 6);
      const thevault = vaultusdc;

      // Vault Computation
      const responseNormalLiq = await thevault.getLiquidationBonusFor(inputAmount, false);
      const responseFlashLiq = await thevault.getLiquidationBonusFor(inputAmount, true);

      // Manual Computation
      let bonusLfactor = await fujiadmin.bonusL();
      let bonusFlashLfactor = await fujiadmin.bonusFlashL();
      bonusLfactor = 1 / bonusLfactor[1];
      bonusFlashLfactor = 1 / bonusFlashLfactor[1];

      const computedrNormalLiq = inputAmount * bonusLfactor;
      const computedrFlashLiq = inputAmount * bonusFlashLfactor;

      await expect(responseNormalLiq / 1).to.equal(computedrNormalLiq);
      await expect(responseFlashLiq / 1).to.equal(computedrFlashLiq);
    });

    it("3.- getNeededCollateralFor, vaultdai inputs 5000 Amount, checks computation", async () => {
      const inputAmount = ethers.utils.parseUnits("5000", 18);
      const thevault = vaultdai;

      // Vault Computation
      const collatNeeded = await thevault.getNeededCollateralFor(inputAmount, false);
      const collatNeededwFactor = await thevault.getNeededCollateralFor(inputAmount, true);
      // console.log(collatNeeded/1, collatNeededwFactor/1);

      // Manual Computation
      let collatF = await thevault.collatF();
      let safetyF = await thevault.safetyF();
      collatF = collatF[0] / collatF[1];
      safetyF = safetyF[0] / safetyF[1];

      let price = await oracle.latestRoundData();
      price = price.answer / 1e18;
      // console.log(collatF, safetyF, price);

      const computedcollatNeeded = inputAmount * price;
      const computedcollatNeededwFactor = inputAmount * price * collatF * safetyF;
      // console.log(computedcollatNeeded,computedcollatNeededwFactor );

      await expect(collatNeeded / 1).to.equal(computedcollatNeeded);
      await expect(collatNeededwFactor / 1).to.equal(computedcollatNeededwFactor);
    });

    it("4.- getNeededCollateralFor, vaultusdt inputs 7000 Amount, checks computation", async () => {
      const inputAmount = ethers.utils.parseUnits("7000", 6);
      const thevault = vaultusdt;

      // Vault Computation
      const collatNeeded = await thevault.getNeededCollateralFor(inputAmount, false);
      const collatNeededwFactor = await thevault.getNeededCollateralFor(inputAmount, true);
      // console.log(collatNeeded/1, collatNeededwFactor/1);

      // Manual Computation
      let collatF = await thevault.collatF();
      let safetyF = await thevault.safetyF();
      collatF = collatF[0] / collatF[1];
      safetyF = safetyF[0] / safetyF[1];

      let price = await oracle.latestRoundData();
      price = price.answer;
      // console.log(collatF, safetyF, price);

      const computedcollatNeeded = (inputAmount / 1e6) * price;
      const computedcollatNeededwFactor = (inputAmount / 1e6) * price * collatF * safetyF;
      // console.log(computedcollatNeeded,computedcollatNeededwFactor );

      await expect(collatNeeded / 1).to.equal(computedcollatNeeded);
      await expect(collatNeededwFactor / 1).to.equal(computedcollatNeededwFactor);
    });

    it("5.- harvesting COMP", async () => {
      const comptoken = await ethers.getContractAt(
        "IERC20",
        "0xc00e94Cb662C3520282E6f5717214004A7f26888"
      );

      // Set up variables
      const thevault = vaultdai;
      const userX = users[11];
      const depositAmount = ethers.utils.parseEther("995");
      const borrowAmount = ethers.utils.parseUnits("100000", 18);
      const smallDeposits = ethers.utils.parseEther("0.1");

      // For COMP set up compound as provider
      await thevault.setActiveProvider(compound.address);

      // Do a deposit
      await thevault
        .connect(userX)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      // Do small deposits to updateState in Compound contracts in long time periods
      for (let i = 1; i < 11; i++) {
        await thevault.connect(users[i]).deposit(smallDeposits, { value: smallDeposits });
        await advanceblocks(50);
      }

      // Pass 0 for COMP farming
      await thevault.connect(users[0]).harvestRewards(0, "0x");

      await expect(await comptoken.balanceOf(TREASURY_ADDR)).to.be.gt(0);
    });

    it("6.- harvesting stkAave", async () => {
      const stkAavetoken = await ethers.getContractAt(
        "IERC20",
        "0x4da27a545c0c5B758a6BA100e3a049001de870f5"
      );

      // Set up variables
      const thevault = vaultdai;
      const userX = users[12];
      const depositAmount = ethers.utils.parseEther("995");
      const borrowAmount = ethers.utils.parseUnits("100000", 18);
      const smallDeposits = ethers.utils.parseEther("0.1");

      // For stkAave set up Aave as provider
      await thevault.setActiveProvider(aave.address);

      // Do a deposit
      await thevault
        .connect(userX)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      // Do small deposits to updateState in Compound contracts in long time periods
      for (let i = 1; i < 11; i++) {
        await thevault.connect(users[i]).deposit(smallDeposits, { value: smallDeposits });
        await advanceblocks(50);
      }

      // Pass 1 for stkAave farming
      await thevault.connect(users[0]).harvestRewards(
        1,
        ethers.utils.defaultAbiCoder.encode(
          ["address[]"],
          [
            [
              "0x030bA81f1c18d280636F32af80b9AAd02Cf0854e", //aWETH
              "0xF63B34710400CAd3e044cFfDcAb00a0f32E33eCf", //variableDebtWETH
              "0x6C3c78838c761c6Ac7bE9F59fe808ea2A6E4379d", //variableDebtDAI
              "0x619beb58998eD2278e08620f97007e1116D5D25b", //variableDebtUSDC
              "0x531842cEbbdD378f8ee36D171d6cC9C4fcf475Ec", //variableDebtUSDT
              "0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656", //awBTC
              "0x9c39809Dec7F95F5e0713634a4D0701329B3b4d2", //variableDebtwBTC
            ],
          ]
        )
      );

      await expect(await stkAavetoken.balanceOf(TREASURY_ADDR)).to.be.gt(0);
    });
  });
});
