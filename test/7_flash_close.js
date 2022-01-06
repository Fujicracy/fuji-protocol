const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, FLASHLOAN } = require("./helpers");
const { testFlashClose1, testFlashClose2, testFlashClose3 } = require("./Fliquidator");

const { fixture, VAULTS, ASSETS } = require("./core-utils");

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

    this.owner = this.users[0];
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

  describe("Flash Close positions in Aave", function () {
    before(async function () {
      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.aave.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      testFlashClose1(
        [vaultethdai, vaultethusdc, vaultethusdt],
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
      testFlashClose1([vaultethdai, vaultethusdc], DEPOSIT_ETH, BORROW_STABLE, FLASHLOAN.BALANCER);
      testFlashClose1(
        [vaultethdai, vaultethusdc, vaultethusdt],
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.CREAM
      );

      testFlashClose1([vaultethwbtc], DEPOSIT_ETH, BORROW_WBTC, FLASHLOAN.AAVE);
      testFlashClose1([vaultethwbtc], DEPOSIT_ETH, BORROW_WBTC, FLASHLOAN.BALANCER);
      testFlashClose1([vaultethwbtc], DEPOSIT_ETH, BORROW_WBTC, FLASHLOAN.CREAM);
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
      testFlashClose2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC, FLASHLOAN.AAVE);
      testFlashClose2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC, FLASHLOAN.BALANCER);
      testFlashClose2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC, FLASHLOAN.CREAM);

      testFlashClose2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.AAVE);
      testFlashClose2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.BALANCER);
      testFlashClose2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE, FLASHLOAN.CREAM);
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
      testFlashClose3([vaultdaieth, vaultusdceth], DEPOSIT_STABLE, BORROW_ETH, FLASHLOAN.AAVE);
      testFlashClose3([vaultdaieth, vaultusdceth], DEPOSIT_STABLE, BORROW_ETH, FLASHLOAN.BALANCER);
      testFlashClose3([vaultdaieth, vaultusdceth], DEPOSIT_STABLE, BORROW_ETH, FLASHLOAN.CREAM);

      testFlashClose3([vaultwbtceth], DEPOSIT_WBTC, BORROW_ETH, FLASHLOAN.AAVE);
      testFlashClose3([vaultwbtceth], DEPOSIT_WBTC, BORROW_ETH, FLASHLOAN.BALANCER);
      testFlashClose3([vaultwbtceth], DEPOSIT_WBTC, BORROW_ETH, FLASHLOAN.CREAM);
    });
  });
});
