const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, FLASHLOAN } = require("./helpers");

const { fixture, ASSETS, VAULTS } = require("./core-utils");

const {
  testDeposit1a,
  testDeposit2a,
  testBorrow1,
  testBorrow2,
  testBorrow3,
  testPaybackAndWithdraw1,
  testPaybackAndWithdraw2,
  testPaybackAndWithdraw3,
} = require("./FujiVault");
const { testRefinance1, testRefinance2, testRefinance3 } = require("./Controller");

const vaults = {};
for (const v of VAULTS) {
  vaults[v.name] = v;
}
const {
  vaultethdai,
  vaultethusdc,
  vaultethusdt,
  vaultethwbtc,
  vaultwbtceth,
  vaultwbtcdai,
  vaultwbtcusdc,
  vaultwbtcusdt,
  vaultdaieth,
  vaultdaiwbtc,
  vaultusdceth,
  vaultusdcwbtc,
  vaultusdteth,
  vaultusdtwbtc,
} = vaults;

const [DEPOSIT_STABLE, DEPOSIT_ETH, DEPOSIT_WBTC] = [400, 0.1, 0.0075];

const [BORROW_STABLE, BORROW_ETH, BORROW_WBTC] = [
  DEPOSIT_STABLE / 2,
  DEPOSIT_ETH / 2,
  DEPOSIT_WBTC / 2,
];

describe("Core Fuji Instance", function () {
  before(async function () {
    this.users = await ethers.getSigners();
    this.user1 = this.users[1];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(fixture);
    this.evmSnapshot0 = await evmSnapshot();

    for (let x = 0; x < 4; x += 1) {
      const block = await provider.getBlock();
      await this.f.swapper
        .connect(this.users[x])
        .swapETHForExactTokens(
          parseUnits(DEPOSIT_STABLE),
          [ASSETS.WETH.address, ASSETS.DAI.address],
          this.users[x].address,
          block.timestamp + 60,
          { value: parseUnits(500) }
        );
      await this.f.swapper
        .connect(this.users[x])
        .swapETHForExactTokens(
          parseUnits(DEPOSIT_STABLE, 6),
          [ASSETS.WETH.address, ASSETS.USDC.address],
          this.users[x].address,
          block.timestamp + 60,
          { value: parseUnits(500) }
        );
      await this.f.swapper
        .connect(this.users[x])
        .swapETHForExactTokens(
          parseUnits(DEPOSIT_STABLE, 6),
          [ASSETS.WETH.address, ASSETS.USDT.address],
          this.users[x].address,
          block.timestamp + 60,
          { value: parseUnits(500) }
        );
      await this.f.swapper
        .connect(this.users[x])
        .swapETHForExactTokens(
          parseUnits(DEPOSIT_WBTC, 8),
          [ASSETS.WETH.address, ASSETS.WBTC.address],
          this.users[x].address,
          block.timestamp + 60,
          { value: parseUnits(500) }
        );
    }
  });

  beforeEach(async function () {
    if (this.evmSnapshot1) await evmRevert(this.evmSnapshot1);

    this.evmSnapshot1 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("Aave as Provider", function () {
    before(async function () {
      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.aave.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      testDeposit1a(
        [vaultethdai, vaultethusdc, vaultethusdt, vaultethwbtc],
        DEPOSIT_ETH,
        ASSETS.WETH.aToken
      );

      testBorrow1([vaultethdai, vaultethusdc, vaultethusdt], DEPOSIT_ETH, BORROW_STABLE);
      testBorrow1([vaultethwbtc], DEPOSIT_ETH, BORROW_WBTC);

      testPaybackAndWithdraw1(
        [vaultethdai, vaultethusdc, vaultethusdt],
        DEPOSIT_ETH,
        BORROW_STABLE
      );
      testPaybackAndWithdraw1([vaultethwbtc], DEPOSIT_ETH, BORROW_WBTC);

      testRefinance1(
        [vaultethdai, vaultethusdc, vaultethusdt],
        "aave",
        "compound",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
      testRefinance1(
        [vaultethdai, vaultethusdc],
        "aave",
        "compound",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.DYDX
      );
      testRefinance1(
        [vaultethdai, vaultethusdc, vaultethusdt],
        "aave",
        "compound",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.CREAM
      );

      //testRefinance1([vaultethwbtc], "aave", "dydx", DEPOSIT_ETH, BORROW_WBTC, FLASHLOAN.AAVE);
      //testRefinance1([vaultethwbtc], "aave", "dydx", DEPOSIT_ETH, BORROW_WBTC, FLASHLOAN.DYDX);
      //testRefinance1([vaultethwbtc], "aave", "dydx", DEPOSIT_ETH, BORROW_WBTC, FLASHLOAN.CREAM);

      testRefinance1([vaultethwbtc], "aave", "ironBank", DEPOSIT_ETH, BORROW_WBTC, FLASHLOAN.AAVE);
      //testRefinance1([vaultethwbtc], "aave", "ironBank", DEPOSIT_ETH, BORROW_WBTC, FLASHLOAN.DYDX);
      testRefinance1([vaultethwbtc], "aave", "ironBank", DEPOSIT_ETH, BORROW_WBTC, FLASHLOAN.CREAM);
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
      testDeposit2a([vaultwbtcdai], DEPOSIT_WBTC);

      testBorrow2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);
      testBorrow2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC);

      testPaybackAndWithdraw2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC);

      //// mint-paused for WBTC in Compound
      //testRefinance2([vaultwbtcdai, vaultwbtcusdc], "aave", "compound", DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.AAVE);
      //testRefinance2([vaultwbtcdai, vaultwbtcusdc], "aave", "compound", DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.DYDX);
      //testRefinance2([vaultwbtcdai, vaultwbtcusdc, vaultwbtcusdt], "aave", "compound", DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.CREAM);

      //// DYDX Market doesnt exist!
      //testRefinance2([vaultwbtcdai, vaultwbtcusdc], "aave", "dydx", DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.AAVE);
      //testRefinance2([vaultwbtcdai, vaultwbtcusdc], "aave", "dydx", DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.DYDX);
      //testRefinance2([vaultwbtcdai, vaultwbtcusdc], "aave", "dydx", DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.CREAM);

      //// borrow-paused for WBTC in Compound
      //testRefinance2([vaultdaiwbtc, vaultusdcwbtc], "aave", "compound", DEPOSIT_STABLE, BORROW_WBTC, FLASHLOAN.AAVE);
      //testRefinance2([vaultdaiwbtc, vaultusdcwbtc], "aave", "compound", DEPOSIT_STABLE, BORROW_WBTC, FLASHLOAN.DYDX);
      //testRefinance2([vaultdaiwbtc, vaultusdcwbtc], "aave", "compound", DEPOSIT_STABLE, BORROW_WBTC, FLASHLOAN.CREAM);

      //// DYDX Market doesnt exist!
      //testRefinance2([vaultdaiwbtc, vaultusdcwbtc], "aave", "dydx", DEPOSIT_STABLE, BORROW_WBTC, FLASHLOAN.AAVE);
      //testRefinance2([vaultdaiwbtc, vaultusdcwbtc], "aave", "dydx", DEPOSIT_STABLE, BORROW_WBTC, FLASHLOAN.DYDX);
      //testRefinance2([vaultdaiwbtc, vaultusdcwbtc], "aave", "dydx", DEPOSIT_STABLE, BORROW_WBTC, FLASHLOAN.CREAM);
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
      testBorrow3([vaultdaieth, vaultusdceth], DEPOSIT_STABLE, BORROW_ETH);

      testPaybackAndWithdraw3([vaultwbtceth], DEPOSIT_WBTC, BORROW_ETH);
      testPaybackAndWithdraw3([vaultdaieth, vaultusdceth], DEPOSIT_STABLE, BORROW_ETH);

      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "aave",
        "compound",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.AAVE
      );
      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "aave",
        "compound",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.DYDX
      );
      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "aave",
        "compound",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.CREAM
      );

      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "aave",
        "dydx",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.AAVE
      );
      //testRefinance3([vaultdaieth, vaultusdceth], "aave", "dydx", DEPOSIT_STABLE, BORROW_ETH, FLASHLOAN.DYDX);
      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "aave",
        "dydx",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.CREAM
      );

      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "aave",
        "ironBank",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.AAVE
      );
      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "aave",
        "ironBank",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.DYDX
      );
      // re-entered
      //testRefinance3([vaultdaieth, vaultusdceth], "aave", "ironBank", DEPOSIT_STABLE, BORROW_ETH, FLASHLOAN.CREAM);
    });
  });
});
