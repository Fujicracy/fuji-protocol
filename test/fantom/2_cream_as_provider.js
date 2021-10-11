const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { fixture, ASSETS, VAULTS } = require("./utils");
const { parseUnits, evmSnapshot, evmRevert, FLASHLOAN } = require("../helpers");

const {
  testDeposit1,
  testDeposit2,
  testBorrow1,
  testBorrow2,
  testBorrow3,
  testPaybackAndWithdraw1,
  testPaybackAndWithdraw2,
  testPaybackAndWithdraw3,
} = require("../FujiVault");

const { testRefinance1, testRefinance2, testRefinance3 } = require("../Controller");

const CREAM_FUJI_MAPPING = "0x1eEdE44b91750933C96d2125b6757C4F89e63E20";

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

const [DEPOSIT_STABLE, DEPOSIT_FTM, DEPOSIT_WETH, DEPOSIT_WBTC] = [800, 400, 0.22, 0.014];

const [BORROW_STABLE, BORROW_FTM, BORROW_WETH, BORROW_WBTC] = [
  DEPOSIT_STABLE / 2,
  DEPOSIT_FTM / 2,
  DEPOSIT_WETH / 2,
  DEPOSIT_WBTC / 2,
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

  describe("Cream as Provider", function () {
    before(async function () {
      evmRevert(evmSnapshot1);
      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.cream.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      testDeposit1(
        CREAM_FUJI_MAPPING,
        [vaultftmdai, vaultftmusdc, vaultftmweth, vaultftmwbtc],
        DEPOSIT_FTM
      );

      testBorrow1([vaultftmdai, vaultftmusdc], DEPOSIT_FTM, BORROW_STABLE);
      testBorrow1([vaultftmweth], DEPOSIT_FTM, BORROW_WETH);
      testBorrow1([vaultftmwbtc], DEPOSIT_FTM, BORROW_WBTC);

      testPaybackAndWithdraw1([vaultftmdai, vaultftmusdc], DEPOSIT_FTM, BORROW_STABLE);
      testPaybackAndWithdraw1([vaultftmweth], DEPOSIT_FTM, BORROW_WETH);
      testPaybackAndWithdraw1([vaultftmwbtc], DEPOSIT_FTM, BORROW_WBTC);
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
      testDeposit2(
        CREAM_FUJI_MAPPING,
        [vaultwftmdai, vaultwftmusdc, vaultwftmweth, vaultwftmwbtc],
        DEPOSIT_FTM
      );
      testDeposit2(CREAM_FUJI_MAPPING, [vaultdaiwftm, vaultusdcwftm], DEPOSIT_STABLE);
      testDeposit2(
        CREAM_FUJI_MAPPING,
        [vaultwethwftm, vaultwethdai, vaultwethusdc, vaultwethwbtc],
        DEPOSIT_WETH
      );
      testDeposit2(
        CREAM_FUJI_MAPPING,
        [vaultwbtcwftm, vaultwbtcdai, vaultwbtcusdc, vaultwbtcweth],
        DEPOSIT_WBTC
      );

      testBorrow2([vaultwethdai, vaultwethusdc], DEPOSIT_WETH, BORROW_STABLE);
      testBorrow2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);
      testBorrow2([vaultdaiwftm, vaultusdcwftm], DEPOSIT_STABLE, BORROW_FTM);
      testBorrow2([vaultdaiweth, vaultusdcweth], DEPOSIT_STABLE, BORROW_WETH);
      testBorrow2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC);

      testPaybackAndWithdraw2([vaultdaiweth, vaultusdcweth], DEPOSIT_STABLE, BORROW_WETH);
      testPaybackAndWithdraw2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC);
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
      testBorrow3([vaultdaiftm], DEPOSIT_STABLE, BORROW_FTM);

      testPaybackAndWithdraw3([vaultwbtcftm], DEPOSIT_WBTC, BORROW_FTM * 0.5);
      testPaybackAndWithdraw3([vaultwethftm], DEPOSIT_WETH, BORROW_FTM * 0.5);
      testPaybackAndWithdraw3([vaultdaiftm, vaultusdcftm], DEPOSIT_STABLE, BORROW_FTM * 0.5);
    });

    // testRefinance1([vaultethusdc, vaultethdai], "fuse3", "fuse18", 1);
    // testRefinance2([vaultusdcdai], "fuse3", "fuse18", 1);
    // testRefinance3([vaultdaieth], "fuse3", "fuse18", 1);
  });
});
