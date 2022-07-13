const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { fixture, ASSETS, VAULTS } = require("./utils");
const { parseUnits, evmSnapshot, evmRevert, FLASHLOAN } = require("../helpers");

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

const { testRefinance1, testRefinance2, testRefinance3 } = require("../controller");

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

  describe("AaveV3 as Provider", function () {
    before(async function () {
      evmRevert(evmSnapshot1);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.aavev3.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      testDeposit1a(
        [vaultethdai, vaultethusdc, vaultethwbtc],
        DEPOSIT_ETH,
        ASSETS.ETH.aTokenV3
      );

      testBorrow1([vaultethdai, vaultethusdc], DEPOSIT_ETH, BORROW_STABLE);
      testBorrow1([vaultethwbtc], DEPOSIT_ETH, BORROW_WBTC);

      testPaybackAndWithdraw1([vaultethdai, vaultethusdc], DEPOSIT_ETH, BORROW_STABLE);
      testPaybackAndWithdraw1([vaultethwbtc], DEPOSIT_ETH, BORROW_WBTC);
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
      testDeposit2a(
        [vaultwethdai, vaultwethusdc, vaultwethwbtc],
        DEPOSIT_ETH,
        ASSETS,
        true
      );
      testDeposit2a([vaultdaiweth, vaultusdcweth], DEPOSIT_STABLE, ASSETS, true);
      testDeposit2a(
        [vaultwbtcdai, vaultwbtcusdc, vaultwbtcweth],
        DEPOSIT_WBTC,
        ASSETS,
        true
      );

      testBorrow2([vaultwethdai, vaultwethusdc], DEPOSIT_ETH, BORROW_STABLE);
      testBorrow2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);
      testBorrow2([vaultdaiweth, vaultusdcweth], DEPOSIT_STABLE, BORROW_ETH);
      testBorrow2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC);

      testPaybackAndWithdraw2([vaultdaiweth, vaultusdcweth], DEPOSIT_STABLE, BORROW_ETH);
      testPaybackAndWithdraw2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC);

      testRefinance2([vaultwbtcusdc], "aavev3", "wepiggy", DEPOSIT_WBTC, BORROW_STABLE, 3);
      testRefinance2([vaultwbtcusdc], "aavev3", "wepiggy", DEPOSIT_WBTC, BORROW_STABLE, 4);
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
      testBorrow3([vaultdaieth], DEPOSIT_STABLE, BORROW_ETH);

      testPaybackAndWithdraw3([vaultwbtceth], DEPOSIT_WBTC, BORROW_ETH * 0.5);
      testPaybackAndWithdraw3([vaultdaieth, vaultusdceth], DEPOSIT_STABLE, BORROW_ETH * 0.5);
    });
  });
});
