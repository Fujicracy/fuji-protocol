const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, FLASHLOAN } = require("./../helpers");

const { fixture, ASSETS, VAULTS } = require("./utils");

const {
  testDeposit1dForce,
  testDeposit2dForce,
  testBorrow1,
  testBorrow2,
  testBorrow3,
  testPaybackAndWithdraw1,
  testPaybackAndWithdraw2,
  testPaybackAndWithdraw3,
} = require("./../FujiVault");
const { testRefinance1, testRefinance2, testRefinance3 } = require("./../Controller");

const DFORCE_FUJI_MAPPING = "0x410f9179eD194b8b3583abfEbB5C3ef2aCD62A34";

const vaults = {};

for (const v of VAULTS) {
  vaults[v.name] = v;
}
const {
  vaultethdai,
  vaultethusdc,
  vaultethwbtc,
  vaultdaieth,
  vaultdaiusdc,
  vaultdaiwbtc,
  vaultusdceth,
  vaultusdcdai,
  vaultusdcwbtc,
  vaultwbtceth,
  vaultwbtcdai,
  vaultwbtcusdc,
  vaultwethdai,
  vaultwethusdc,
  vaultwethwbtc,
  vaultdaiweth,
  vaultusdcweth,
  vaultwbtcweth,
} = vaults;

const [DEPOSIT_STABLE, DEPOSIT_ETH, DEPOSIT_WBTC] = [80, 0.02, 0.0015];

const [BORROW_STABLE, BORROW_ETH, BORROW_WBTC] = [
    DEPOSIT_STABLE / 8,
    DEPOSIT_ETH / 8,
    DEPOSIT_WBTC / 8,
  ];

describe("Arbitrum Fuji Instance", function () {
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
      await this.f.arbitrumWrapper.connect(this.users[x]).deposit({ value: parseUnits(500) });

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

  describe("dForce as Provider", function () {
    before(async function () {
      evmRevert(evmSnapshot1);
      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.dforce.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      testDeposit1dForce(
        DFORCE_FUJI_MAPPING,
        [vaultethdai, vaultethusdc],
        DEPOSIT_ETH
      );

      testBorrow1([vaultethdai, vaultethusdc], DEPOSIT_ETH, BORROW_STABLE);

      testPaybackAndWithdraw1(
        [vaultethdai, vaultethusdc],
        DEPOSIT_ETH,
        BORROW_STABLE
      );

      testRefinance1(
        [vaultethdai, vaultethusdc],
        "dforce",
        "wepiggy",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.BALANCER
      );
      testRefinance1(
        [vaultethdai, vaultethusdc],
        "dforce",
        "aavev3",
        DEPOSIT_ETH,
        BORROW_STABLE,
        FLASHLOAN.AAVEV3
      );
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
        testDeposit2dForce(
            DFORCE_FUJI_MAPPING,
            [vaultwbtcdai, vaultwbtcusdc],
            DEPOSIT_WBTC
        );

        testBorrow2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);

        testPaybackAndWithdraw2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);

        testRefinance2(
            [vaultwbtcdai, vaultwbtcusdc],
            "dforce",
            "aavev3",
            DEPOSIT_WBTC,
            BORROW_STABLE,
            FLASHLOAN.BALANCER
        );
        testRefinance2(
            [vaultwbtcdai, vaultwbtcusdc],
            "dforce",
            "wepiggy",
            DEPOSIT_WBTC,
            BORROW_STABLE,
            FLASHLOAN.AAVEV3
        );
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
        testBorrow3([vaultusdceth], DEPOSIT_STABLE, BORROW_ETH);
        testPaybackAndWithdraw3([vaultusdceth], DEPOSIT_STABLE, BORROW_ETH);
        testRefinance3(
            [vaultusdceth],
            "dforce",
            "aavev3",
            DEPOSIT_STABLE,
            BORROW_ETH,
            FLASHLOAN.BALANCER
        );
        testRefinance3(
            [vaultusdceth],
            "dforce",
            "aavev3",
            DEPOSIT_STABLE,
            BORROW_ETH,
            FLASHLOAN.AAVEV3
        );
    });
  });
});
