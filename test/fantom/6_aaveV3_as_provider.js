const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, FLASHLOAN } = require("../helpers");

const { fixture, setERC20UserBalance, ASSETS, VAULTS } = require("./utils");

const {
  testDeposit1a,
  testDeposit2a,
  testBorrow1,
  testBorrow2,
  testBorrow3,
  testPaybackAndWithdraw1,
  testPaybackAndWithdraw2,
  testPaybackAndWithdraw3,
} = require("../FujiVault");

const { testRefinance1, testRefinance2, testRefinance3 } = require("../Controller");

const vaults = {};

for (const v of VAULTS) {
  vaults[v.name] = v;
}

const VAULTS_FOR_TESTING = [
  "vaultftmdai",
  "vaultftmusdc",
  "vaultwethdai",
  "vaultwethusdc",
  "vaultwbtcdai",
  "vaultwbtcusdc",
  "vaultdaiftm"
]

const {
  vaultftmdai,
  vaultftmusdc,
  // vaultftmweth,
  // vaultftmwbtc,
  vaultdaiftm,
  // vaultdaiusdc,
  // vaultdaiwftm,
  // vaultdaiweth,
  // vaultdaiwbtc,
  // vaultusdcftm,
  // vaultusdcdai,
  // vaultusdcwftm,
  // vaultusdcweth,
  // vaultusdcwbtc,
  // vaultwftmdai,
  // vaultwftmusdc,
  // vaultwftmweth,
  // vaultwftmwbtc,
  // vaultwethftm,
  vaultwethdai,
  vaultwethusdc,
  // vaultwethwftm,
  // vaultwethwbtc,
  // vaultwbtcftm,
  vaultwbtcdai,
  vaultwbtcusdc,
  // vaultwbtcwftm,
  // vaultwbtcweth,
} = vaults;

const [DEPOSIT_STABLE, DEPOSIT_FTM, DEPOSIT_WETH, DEPOSIT_WBTC] = [5000, 5000, 1, 1];

const [BORROW_STABLE, BORROW_FTM, BORROW_WETH, BORROW_WBTC] = [
  DEPOSIT_STABLE / 20,
  DEPOSIT_FTM / 20,
  DEPOSIT_WETH / 20,
  DEPOSIT_WBTC / 20,
];

describe("Fantom Fuji Instance", function () {
  this.evmSnapshot0;
  this.evmSnapshot1;
  this.evmSnapshot2;

  before(async function () {
    this.evmSnapshot0 = await evmSnapshot();

    this.users = await ethers.getSigners();
    this.user1 = this.users[1];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(fixture);
  
    const assetsToLoad = [
      {
        address: ASSETS.DAI.address,
        balanceToSet: parseUnits(DEPOSIT_STABLE * 10, ASSETS.DAI.decimals)
      },
      {
        address: ASSETS.USDC.address,
        balanceToSet: parseUnits(DEPOSIT_STABLE * 10, ASSETS.USDC.decimals)
      },
      {
        address: ASSETS.WETH.address,
        balanceToSet: parseUnits(DEPOSIT_WETH * 10, ASSETS.WETH.decimals)
      },
      {
        address: ASSETS.WBTC.address,
        balanceToSet: parseUnits(DEPOSIT_WBTC * 10, ASSETS.WBTC.decimals)
      }
    ];
    for (let i = 0; i < assetsToLoad.length; i++) {
      for (let x = 0; x < 4; x += 1) {
        const asset = assetsToLoad[i];
        await setERC20UserBalance(this.users[x].address, asset.address, asset.balanceToSet)
      }
    } 
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("AaveV3 as Provider", function () {
    before(async function () {
      for (let i = 0; i < VAULTS_FOR_TESTING.length; i += 1) {
        await this.f[VAULTS_FOR_TESTING[i]].setActiveProvider(this.f.aaveV3.address);
      }
      this.evmSnapshot1 = await evmSnapshot();
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      beforeEach(async function () {
        if (this.evmSnapshot2) await evmRevert(this.evmSnapshot2);
        this.evmSnapshot2 = await evmSnapshot();
      });

      after(async function () {
        evmRevert(this.evmSnapshot1);
      });

      testDeposit1a([vaultftmdai, vaultftmusdc], DEPOSIT_FTM, ASSETS.FTM.aTokenV3);

      testBorrow1([vaultftmdai, vaultftmusdc], DEPOSIT_FTM, BORROW_STABLE);

      testPaybackAndWithdraw1([vaultftmdai, vaultftmusdc], DEPOSIT_FTM, BORROW_STABLE);

      testRefinance1([vaultftmdai, vaultftmusdc], "hundred", "aaveV3", DEPOSIT_FTM, BORROW_STABLE, FLASHLOAN.AAVE);
      testRefinance1([vaultftmdai, vaultftmusdc],"aaveV3","geist",DEPOSIT_FTM,BORROW_STABLE,FLASHLOAN.AAVE);
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
      beforeEach(async function () {
        if (this.evmSnapshot2) await evmRevert(this.evmSnapshot2);
        this.evmSnapshot2 = await evmSnapshot();
      });

      after(async function () {
        evmRevert(this.evmSnapshot1);
      });

      testDeposit2a([vaultwethdai, vaultwethusdc,], DEPOSIT_WETH, ASSETS, true);
      testDeposit2a([ vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, ASSETS, true);

      testBorrow2([vaultwethdai, vaultwethusdc], DEPOSIT_WETH, BORROW_STABLE);
      testBorrow2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);

      testPaybackAndWithdraw2([vaultwethdai, vaultwethusdc], DEPOSIT_WETH, BORROW_STABLE);
      testPaybackAndWithdraw2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);

      testRefinance2([vaultwethusdc], "hundred", "aaveV3", DEPOSIT_WETH, BORROW_STABLE, FLASHLOAN.AAVE);
      testRefinance2([vaultwbtcusdc], "aaveV3", "geist", DEPOSIT_WETH, BORROW_STABLE, FLASHLOAN.AAVE);
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
      beforeEach(async function () {
        if (this.evmSnapshot2) await evmRevert(this.evmSnapshot2);
        this.evmSnapshot2 = await evmSnapshot();
      });

      after(async function () {
        evmRevert(this.evmSnapshot1);
      });

      testBorrow3([vaultdaiftm], DEPOSIT_STABLE, BORROW_FTM);

      testPaybackAndWithdraw3([vaultdaiftm], DEPOSIT_STABLE, BORROW_FTM);
    });
  });
});
