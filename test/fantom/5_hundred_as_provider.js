const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, FLASHLOAN } = require("./../helpers");

const { fixture, ASSETS, VAULTS } = require("./utils");

const {
  testDeposit1,
  testDeposit2,
  testBorrow1,
  testBorrow2,
  testBorrow3,
  testPaybackAndWithdraw1,
  testPaybackAndWithdraw2,
  testPaybackAndWithdraw3
} = require("./../FujiVault");

const { testRefinance1, testRefinance2, testRefinance3 } = require("./../Controller");

const HUNDRED_FUJI_MAPPING = "0xE89f9aFe2cd8B0498FC575238b0ef65Cf24e3De2";

const vaults = {};

for (const v of VAULTS) {
  vaults[v.name] = v;
}

const {
  vaultftmdai,
  vaultftmusdc,
  vaultftmweth,
  vaultftmwbtc,
  vaultdaiftm,
  vaultdaiusdc,
  vaultdaiwftm,
  vaultdaiweth,
  vaultdaiwbtc,
  vaultusdcftm,
  vaultusdcdai,
  vaultusdcwftm,
  vaultusdcweth,
  vaultusdcwbtc,
  vaultwftmdai,
  vaultwftmusdc,
  vaultwftmweth,
  vaultwftmwbtc,
  vaultwethftm,
  vaultwethdai,
  vaultwethusdc,
  vaultwethwftm,
  vaultwethwbtc,
  vaultwbtcftm,
  vaultwbtcdai,
  vaultwbtcusdc,
  vaultwbtcwftm,
  vaultwbtcweth,
} = vaults;

const [DEPOSIT_STABLE, DEPOSIT_FTM, DEPOSIT_WETH, DEPOSIT_WBTC] = [100, 200, 0.125, 0.0075];

const [BORROW_STABLE, BORROW_FTM, BORROW_WETH, BORROW_WBTC] = [
  DEPOSIT_STABLE / 4,
  DEPOSIT_FTM / 4,
  DEPOSIT_WETH / 4,
  DEPOSIT_WBTC / 4,
];

describe("Fantom Fuji Instance", function () {
  let evmSnapshot0;
  let evmSnapshot1;
  let evmSnapshot2;

  before(async function () {
    this.users = await ethers.getSigners();
    this.user1 = this.users[1];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(fixture);
    evmSnapshot0 = await evmSnapshot();

    for (let x = 0; x < 4; x += 1) {
      await this.f.ftmWrapper.connect(this.users[x]).deposit({ value: parseUnits(500) });

      const block = await provider.getBlock();
      await this.f.swapper
        .connect(this.users[x])
        .swapETHForExactTokens(
          parseUnits(DEPOSIT_STABLE),
          [ASSETS.WFTM.address, ASSETS.DAI.address],
          this.users[x].address,
          block.timestamp + 60,
          { value: parseUnits(500) }
        );
      await this.f.swapper
        .connect(this.users[x])
        .swapETHForExactTokens(
          parseUnits(DEPOSIT_STABLE, 6),
          [ASSETS.WFTM.address, ASSETS.USDC.address],
          this.users[x].address,
          block.timestamp + 60,
          { value: parseUnits(500) }
        );
      await this.f.swapper
        .connect(this.users[x])
        .swapETHForExactTokens(
          parseUnits(DEPOSIT_WETH),
          [ASSETS.WFTM.address, ASSETS.WETH.address],
          this.users[x].address,
          block.timestamp + 60,
          { value: parseUnits(500) }
        );
      await this.f.swapper
        .connect(this.users[x])
        .swapETHForExactTokens(
          parseUnits(DEPOSIT_WBTC, 8),
          [ASSETS.WFTM.address, ASSETS.WBTC.address],
          this.users[x].address,
          block.timestamp + 60,
          { value: parseUnits(500) }
        );
    }

    evmSnapshot1 = await evmSnapshot();
  });

  beforeEach(async function () {
    if (evmSnapshot2) await evmRevert(evmSnapshot2);

    evmSnapshot2 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(evmSnapshot0);
  });

  describe("Hundred Finance as Provider", function () {
    before(async function () {
      evmRevert(evmSnapshot1);
      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.hundred.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      testDeposit1(
        HUNDRED_FUJI_MAPPING,
        [vaultftmdai, vaultftmusdc],
        DEPOSIT_FTM
      );

      testBorrow1([vaultftmdai, vaultftmusdc], DEPOSIT_FTM, BORROW_STABLE);

      testPaybackAndWithdraw1(
        [vaultftmdai, vaultftmusdc],
        DEPOSIT_FTM,
        BORROW_STABLE
      );

      testRefinance1(
        [vaultftmdai, vaultftmusdc],
        "hundred",
        "geist",
        DEPOSIT_FTM,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
      testRefinance1(
        [vaultftmdai, vaultftmusdc],
        "hundred",
        "scream",
        DEPOSIT_FTM,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
      testDeposit2(
        HUNDRED_FUJI_MAPPING,
        [vaultwethdai, vaultwethusdc],
        DEPOSIT_WETH
      );
      testDeposit2(
        HUNDRED_FUJI_MAPPING,
        [vaultwbtcdai, vaultwbtcusdc],
        DEPOSIT_WBTC
      );

      testBorrow2([vaultwethdai, vaultwethusdc], DEPOSIT_WETH, BORROW_STABLE);
      testBorrow2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);

      testPaybackAndWithdraw2([vaultwethdai, vaultwethusdc], DEPOSIT_WETH, BORROW_STABLE);
      testPaybackAndWithdraw2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);

      testRefinance2(
        [vaultwethdai, vaultwethusdc],
        "hundred",
        "geist",
        DEPOSIT_WETH,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
      testRefinance2(
        [vaultwbtcdai, vaultwbtcusdc],
        "hundred",
        "scream",
        DEPOSIT_WBTC,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
      testBorrow3([vaultwethftm], DEPOSIT_WETH, BORROW_FTM);
      testPaybackAndWithdraw3([vaultwethftm], DEPOSIT_WETH, BORROW_FTM);
      testRefinance3(
        [vaultwethftm],
        "hundred",
        "geist",
        DEPOSIT_WETH,
        BORROW_FTM,
        FLASHLOAN.AAVE
      );
    });
  });
});
