const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, advanceBlocks, timeTravel } = require("./helpers");

const { fixture } = require("./core-utils");

const { testExecutorRole, testOwnership } = require("./Controller");

describe("Core Fuji Instance", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.deployer = this.users[0];
    this.user = this.users[2];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(fixture);
    this.evmSnapshot0 = await evmSnapshot();
  });

  beforeEach(async function () {
    if (this.evmSnapshot1) await evmRevert(this.evmSnapshot1);

    this.evmSnapshot1 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("Harvesting", function () {
    //it("Should harvest COMP", async function () {
    //const comptoken = await getContractAt(
    //"IERC20",
    //"0xc00e94Cb662C3520282E6f5717214004A7f26888"
    //);

    //// Set up variables
    //const vault = this.f.vaultethdai;
    //const depositAmount = parseUnits("995");
    //const borrowAmount = parseUnits("100000");
    //const smallDeposits = parseUnits("0.1");

    //// For COMP set up compound as provider
    //await vault.setActiveProvider(this.f.compound.address);

    //// Do a deposit
    //await vault
    //.connect(this.user)
    //.depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

    //// Do small deposits to updateState in Compound contracts in long time periods
    //for (let i = 1; i < 11; i++) {
    //await vault.connect(this.users[i]).deposit(smallDeposits, { value: smallDeposits });
    //await advanceBlocks(50);
    //}

    //const vAssetStruct = await vault.vAssets();
    //const collateralBalanceBefore = await this.f.f1155.balanceOf(
    //this.user.address,
    //vAssetStruct.collateralID
    //);

    //// Pass 0 for COMP farming
    //await vault.connect(this.deployer).harvestRewards(0, "0x");

    //expect(await this.f.f1155.balanceOf(this.user.address, vAssetStruct.collateralID)).to.gt(
    //collateralBalanceBefore
    //);
    //});

    it("Should harvest stkAave", async function () {
      // Set up variables
      const vault = this.f.vaultethdai;
      const depositAmount = parseUnits("995");
      const borrowAmount = parseUnits("100000");
      const smallDeposits = parseUnits("0.1");

      // For COMP set up compound as aave
      await vault.setActiveProvider(this.f.aave.address);

      // Do a deposit
      await vault
        .connect(this.user)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      // Do small deposits to updateState in Compound contracts in long time periods
      for (let i = 1; i < 11; i++) {
        await vault.connect(this.users[i]).deposit(smallDeposits, { value: smallDeposits });
        await advanceBlocks(50);
      }

      const vAssetStruct = await vault.vAssets();
      const collateralBalanceBefore = await this.f.f1155.balanceOf(
        this.user.address,
        vAssetStruct.collateralID
      );

      // Pass 1 for stkAave farming
      await vault.connect(this.deployer).harvestRewards(
        1,
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address[]"],
          [
            0,
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

      await vault
        .connect(this.deployer)
        .harvestRewards(1, ethers.utils.defaultAbiCoder.encode(["uint256"], [1]));

      await timeTravel(864000 + 86400); // pass 11 days

      await vault
        .connect(this.deployer)
        .harvestRewards(1, ethers.utils.defaultAbiCoder.encode(["uint256"], [2]));

      console.log(
        collateralBalanceBefore.toString(),
        (await this.f.f1155.balanceOf(this.user.address, vAssetStruct.collateralID)).toString()
      );

      expect(await this.f.f1155.balanceOf(this.user.address, vAssetStruct.collateralID)).to.gt(
        collateralBalanceBefore
      );
    });
  });
});
