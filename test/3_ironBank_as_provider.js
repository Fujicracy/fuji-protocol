const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, FLASHLOAN } = require("./helpers");

const { fixture, ASSETS, VAULTS } = require("./core-utils");

const {
  testDeposit1,
  testDeposit2,
  testBorrow1,
  testBorrow2,
  testBorrow3,
  testPaybackAndWithdraw1,
  testPaybackAndWithdraw2,
  testPaybackAndWithdraw3,
} = require("./FujiVault");
const { testRefinance1, testRefinance2, testRefinance3 } = require("./Controller");

const IRONBANK_FUJI_MAPPING = "0x17525aFdb24D24ABfF18108E7319b93012f3AD24";

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

    evmSnapshot1 = await evmSnapshot();
  });

  beforeEach(async function () {
    if (evmSnapshot2) await evmRevert(evmSnapshot2);

    evmSnapshot2 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(evmSnapshot0);
  });

  describe("IronBank as Provider", function () {
    before(async function () {
      // evmRevert(evmSnapshot1);
      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.ironBank.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      testDeposit1(
        IRONBANK_FUJI_MAPPING,
        [vaultethdai, vaultethusdc, vaultethusdt, vaultethwbtc],
        DEPOSIT_ETH
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
        "ironBank",
        "compound",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
      testRefinance1(
        [vaultethdai, vaultethusdc],
        "ironBank",
        "compound",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.DYDX
      );
      testRefinance1(
        [vaultethdai, vaultethusdc, vaultethusdt],
        "ironBank",
        "compound",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.CREAM
      );

      testRefinance1(
        [vaultethdai, vaultethusdc],
        "ironBank",
        "dydx",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
      //testRefinance1([vaultethdai, vaultethusdc], "ironBank", "dydx", DEPOSIT_ETH, BORROW_STABLE, FLASHLOAN.DYDX);
      testRefinance1(
        [vaultethdai, vaultethusdc],
        "ironBank",
        "dydx",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.CREAM
      );

      testRefinance1(
        [vaultethdai, vaultethusdc, vaultethusdt],
        "ironBank",
        "aave",
        DEPOSIT_ETH,
        BORROW_WBTC,
        FLASHLOAN.AAVE
      );
      testRefinance1(
        [vaultethdai, vaultethusdc],
        "ironBank",
        "aave",
        DEPOSIT_ETH,
        BORROW_WBTC,
        FLASHLOAN.DYDX
      );
      testRefinance1(
        [vaultethdai, vaultethusdc, vaultethusdt],
        "ironBank",
        "aave",
        DEPOSIT_ETH,
        BORROW_WBTC,
        FLASHLOAN.CREAM
      );
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
      testDeposit2(
        IRONBANK_FUJI_MAPPING,
        [vaultwbtcdai, vaultwbtcusdc, vaultwbtcusdt],
        DEPOSIT_WBTC
      );

      testBorrow2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);
      testBorrow2([vaultdaiwbtc, vaultusdcwbtc, vaultusdtwbtc], DEPOSIT_STABLE, BORROW_WBTC);

      testPaybackAndWithdraw2(
        [vaultdaiwbtc, vaultusdcwbtc, vaultusdtwbtc],
        DEPOSIT_STABLE,
        BORROW_WBTC
      );

      // mint is paused
      //testRefinance2([vaultwbtcdai, vaultwbtcusdc], "ironBank", "compound", DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.AAVE);
      //testRefinance2([vaultwbtcdai, vaultwbtcusdc], "ironBank", "compound", DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.DYDX);
      //testRefinance2([vaultwbtcdai, vaultwbtcusdc], "ironBank", "compound", DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.CREAM);

      testRefinance2([], "ironBank", "dydx", DEPOSIT_ETH, BORROW_STABLE, FLASHLOAN.AAVE);
      //testRefinance2([], "ironBank", "dydx", DEPOSIT_ETH, BORROW_STABLE, FLASHLOAN.DYDX);
      testRefinance2([], "ironBank", "dydx", DEPOSIT_ETH, BORROW_STABLE, FLASHLOAN.CREAM);

      testRefinance2(
        [vaultwbtcdai, vaultwbtcusdc],
        "ironBank",
        "aave",
        DEPOSIT_WBTC,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
      testRefinance2(
        [vaultwbtcdai, vaultwbtcusdc],
        "ironBank",
        "aave",
        DEPOSIT_WBTC,
        BORROW_STABLE,
        FLASHLOAN.DYDX
      );
      testRefinance2(
        [vaultwbtcdai, vaultwbtcusdc],
        "ironBank",
        "aave",
        DEPOSIT_WBTC,
        BORROW_STABLE,
        FLASHLOAN.CREAM
      );
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
      testBorrow3([vaultdaieth, vaultusdceth, vaultusdteth], DEPOSIT_STABLE, BORROW_ETH);

      testPaybackAndWithdraw3([vaultwbtceth], DEPOSIT_WBTC, BORROW_ETH);
      testPaybackAndWithdraw3(
        [vaultdaieth, vaultusdceth, vaultusdteth],
        DEPOSIT_STABLE,
        BORROW_ETH
      );

      //testRefinance3([vaultwbtceth], "ironBank", "compound", DEPOSIT_WBTC, BORROW_ETH, FLASHLOAN.AAVE);
      //testRefinance3([vaultwbtceth], "ironBank", "compound", DEPOSIT_WBTC, BORROW_ETH, FLASHLOAN.DYDX);
      //testRefinance3([vaultwbtceth], "ironBank", "compound", DEPOSIT_WBTC, BORROW_ETH, FLASHLOAN.CREAM);

      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "ironBank",
        "aave",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.AAVE
      );
      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "ironBank",
        "aave",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.DYDX
      );
      // re-entered
      //testRefinance3([vaultdaieth, vaultusdceth], "ironBank", "aave", DEPOSIT_STABLE, BORROW_ETH, FLASHLOAN.CREAM);
    });
  });
});
