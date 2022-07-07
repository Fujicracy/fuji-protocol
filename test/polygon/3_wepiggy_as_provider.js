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
  testPaybackAndWithdraw3,
} = require("./../FujiVault");
const { testRefinance1, testRefinance2, testRefinance3 } = require("./../Controller");

const WEPIGGY_FUJI_MAPPING = "0x1Cf24e4eC41DA581bEe223E1affEBB62a5A95484";

const vaults = {};

for (const v of VAULTS) {
  vaults[v.name] = v;
}

const {
    vaultmaticdai,
    vaultmaticusdc,
    vaultmaticweth,
    vaultmaticwbtc,
    vaultdaimatic,
    vaultdaiusdc,
    vaultdaiwmatic,
    vaultdaiweth,
    vaultdaiwbtc,
    vaultusdcmatic,
    vaultusdcdai,
    vaultusdcwmatic,
    vaultusdcweth,
    vaultusdcwbtc,
    vaultwmaticdai,
    vaultwmaticusdc,
    vaultwmaticweth,
    vaultwmaticwbtc,
    vaultwethmatic,
    vaultwethdai,
    vaultwethusdc,
    vaultwethwmatic,
    vaultwethwbtc,
    vaultwbtcmatic,
    vaultwbtcdai,
    vaultwbtcusdc,
    vaultwbtcwmatic,
    vaultwbtcweth,
  } = vaults;

const [DEPOSIT_STABLE, DEPOSIT_MATIC, DEPOSIT_WETH, DEPOSIT_WBTC] = [80, 48, 0.02, 0.0015];

const [BORROW_STABLE, BORROW_MATIC, BORROW_WETH, BORROW_WBTC] = [
    DEPOSIT_STABLE / 8,
    DEPOSIT_MATIC / 8,
    DEPOSIT_WETH / 8,
    DEPOSIT_WBTC / 8,
  ];

describe("Polygon Fuji Instance", function () {
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
        await this.f.maticWrapper.connect(this.users[x]).deposit({ value: parseUnits(500) });
  
        const block = await provider.getBlock();
        await this.f.swapper
          .connect(this.users[x])
          .swapETHForExactTokens(
            parseUnits(DEPOSIT_STABLE),
            [ASSETS.WMATIC.address, ASSETS.DAI.address],
            this.users[x].address,
            block.timestamp + 60,
            { value: parseUnits(500) }
          );
        await this.f.swapper
          .connect(this.users[x])
          .swapETHForExactTokens(
            parseUnits(DEPOSIT_STABLE, 6),
            [ASSETS.WMATIC.address, ASSETS.USDC.address],
            this.users[x].address,
            block.timestamp + 60,
            { value: parseUnits(500) }
          );
        await this.f.swapper
          .connect(this.users[x])
          .swapETHForExactTokens(
            parseUnits(DEPOSIT_WETH),
            [ASSETS.WMATIC.address, ASSETS.WETH.address],
            this.users[x].address,
            block.timestamp + 60,
            { value: parseUnits(500) }
          );
        await this.f.swapper
          .connect(this.users[x])
          .swapETHForExactTokens(
            parseUnits(DEPOSIT_WBTC, 8),
            [ASSETS.WMATIC.address, ASSETS.WBTC.address],
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

  describe("WePiggy as Provider", function () {
    before(async function () {
      evmRevert(evmSnapshot1);
      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.wepiggy.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      testDeposit1(
        WEPIGGY_FUJI_MAPPING,
        [vaultmaticdai, vaultmaticusdc],
        DEPOSIT_MATIC
      );

      testBorrow1([vaultmaticdai, vaultmaticusdc], DEPOSIT_MATIC, BORROW_STABLE);

      testPaybackAndWithdraw1(
        [vaultmaticdai, vaultmaticusdc],
        DEPOSIT_MATIC,
        BORROW_STABLE
      );

      testRefinance1(
        [vaultmaticdai, vaultmaticusdc],
        "wepiggy",
        "aave",
        DEPOSIT_MATIC,
        BORROW_STABLE,
        FLASHLOAN.AAVE
      );
      testRefinance1(
        [vaultmaticdai, vaultmaticusdc],
        "wepiggy",
        "aave",
        DEPOSIT_MATIC,
        BORROW_STABLE,
        FLASHLOAN.BALANCER
      );
      testRefinance1(
        [vaultmaticdai, vaultmaticusdc],
        "wepiggy",
        "aave",
        DEPOSIT_MATIC,
        BORROW_STABLE,
        FLASHLOAN.AAVEV3
      );
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
        testDeposit2(
            WEPIGGY_FUJI_MAPPING,
            [vaultwethdai, vaultwethusdc],
            DEPOSIT_WETH
        );
        testDeposit2(
            WEPIGGY_FUJI_MAPPING,
            [vaultwbtcdai, vaultwbtcusdc],
            DEPOSIT_WBTC
        );

        testBorrow2([vaultwethdai, vaultwethusdc], DEPOSIT_WETH, BORROW_STABLE);
        testBorrow2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);

        testPaybackAndWithdraw2([vaultwethdai, vaultwethusdc], DEPOSIT_WETH, BORROW_STABLE);
        testPaybackAndWithdraw2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);

        testRefinance2(
            [vaultwethdai, vaultwethusdc],
            "wepiggy",
            "aave",
            DEPOSIT_WETH,
            BORROW_STABLE,
            FLASHLOAN.AAVE
        );
        testRefinance2(
            [vaultwbtcdai, vaultwbtcusdc],
            "wepiggy",
            "aave",
            DEPOSIT_WBTC,
            BORROW_STABLE,
            FLASHLOAN.BALANCER
        );
        testRefinance2(
            [vaultwbtcdai, vaultwbtcusdc],
            "wepiggy",
            "aave",
            DEPOSIT_WBTC,
            BORROW_STABLE,
            FLASHLOAN.AAVEV3
        );
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
        testBorrow3([vaultwethmatic], DEPOSIT_WETH, BORROW_MATIC);
        testPaybackAndWithdraw3([vaultwethmatic], DEPOSIT_WETH, BORROW_MATIC);
        testRefinance3(
            [vaultwethmatic],
            "wepiggy",
            "aave",
            DEPOSIT_WETH,
            BORROW_MATIC,
            FLASHLOAN.BALANCER
        );
        testRefinance3(
            [vaultwethmatic],
            "wepiggy",
            "aave",
            DEPOSIT_WETH,
            BORROW_MATIC,
            FLASHLOAN.AAVEV3
        );
    });
  });
});
