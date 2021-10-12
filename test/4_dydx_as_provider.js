const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, FLASHLOAN } = require("./helpers");

const { fixture, ASSETS, VAULTS } = require("./core-utils");

const {
  testDeposit1b,
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
const { vaultethdai, vaultethusdc, vaultdaieth, vaultusdceth, vaultusdteth } = vaults;

const [DEPOSIT_STABLE, DEPOSIT_ETH] = [400, 0.1];

const [BORROW_STABLE, BORROW_ETH] = [DEPOSIT_STABLE / 2, DEPOSIT_ETH / 2];

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
    }
  });

  beforeEach(async function () {
    if (this.evmSnapshot1) await evmRevert(this.evmSnapshot1);

    this.evmSnapshot1 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("dydx as Provider", function () {
    before(async function () {
      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.dydx.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      testDeposit1b([vaultethdai, vaultethusdc], DEPOSIT_ETH);

      testBorrow1([vaultethdai, vaultethusdc], DEPOSIT_ETH, BORROW_STABLE);

      testPaybackAndWithdraw1([vaultethdai, vaultethusdc], DEPOSIT_ETH, BORROW_STABLE);

      testRefinance1(
        [vaultethdai, vaultethusdc],
        "dydx",
        "compound",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
      //testRefinance1([vaultethdai, vaultethusdc], "dydx", "compound", DEPOSIT_ETH, BORROW_STABLE, FLASHLOAN.DYDX);
      testRefinance1(
        [vaultethdai, vaultethusdc],
        "dydx",
        "compound",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.CREAM
      );
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
      // dydx propose only DAI and USDC as ERC20
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
      testBorrow3([vaultdaieth, vaultusdceth], DEPOSIT_STABLE, BORROW_ETH);

      testPaybackAndWithdraw3([vaultdaieth, vaultusdceth], DEPOSIT_STABLE, BORROW_ETH);

      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "dydx",
        "compound",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.AAVE
      );
      //testRefinance3([vaultdaieth, vaultusdceth], "dydx", "compound", DEPOSIT_STABLE, BORROW_ETH, FLASHLOAN.DYDX);
      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "dydx",
        "compound",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.CREAM
      );

      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "dydx",
        "aave",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.AAVE
      );
      //testRefinance3([vaultdaieth, vaultusdceth], "dydx", "aave", DEPOSIT_STABLE, BORROW_ETH, FLASHLOAN.DYDX);
      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "dydx",
        "aave",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.CREAM
      );

      testRefinance3(
        [vaultdaieth, vaultusdceth],
        "dydx",
        "ironBank",
        DEPOSIT_STABLE,
        BORROW_ETH,
        FLASHLOAN.AAVE
      );
      //testRefinance3([vaultdaieth, vaultusdceth], "dydx", "ironBank", DEPOSIT_STABLE, BORROW_ETH, FLASHLOAN.DYDX);
      // re-entered
      //testRefinance3([vaultdaieth, vaultusdceth], "dydx", "ironBank", DEPOSIT_STABLE, BORROW_ETH, FLASHLOAN.CREAM);
    });
  });
});
