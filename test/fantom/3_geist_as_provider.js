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

const [DEPOSIT_STABLE, DEPOSIT_FTM, DEPOSIT_WETH, DEPOSIT_WBTC] = [800, 400, 0.25, 0.015];

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

  describe("Geist! as Provider", function () {
    before(async function () {
      evmRevert(evmSnapshot1);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.geist.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {
      testDeposit1a([vaultftmdai, vaultftmusdc, vaultftmweth], DEPOSIT_FTM, ASSETS.FTM.aToken);

      testBorrow1([vaultftmdai, vaultftmusdc], DEPOSIT_FTM, BORROW_STABLE);
      testBorrow1([vaultftmweth], DEPOSIT_FTM, BORROW_WETH);
      testBorrow1([vaultftmwbtc], DEPOSIT_FTM, BORROW_WBTC);

      testPaybackAndWithdraw1([vaultftmdai, vaultftmusdc], DEPOSIT_FTM, BORROW_STABLE);
      testPaybackAndWithdraw1([vaultftmweth], DEPOSIT_FTM, BORROW_WETH);
      testPaybackAndWithdraw1([vaultftmwbtc], DEPOSIT_FTM, BORROW_WBTC);

      testRefinance1([vaultftmusdc, vaultftmdai], "geist", "scream", DEPOSIT_FTM, BORROW_STABLE, 2);
      testRefinance1([vaultftmweth], "geist", "scream", DEPOSIT_FTM, BORROW_WETH, 2);
      testRefinance1([vaultftmwbtc], "geist", "scream", DEPOSIT_FTM, BORROW_WBTC, 2);
      testRefinance1([vaultftmusdc, vaultftmdai], "geist", "cream", DEPOSIT_FTM, BORROW_STABLE, 0);
      testRefinance1([vaultftmweth], "geist", "cream", DEPOSIT_FTM, BORROW_WETH, 0);
      testRefinance1([vaultftmwbtc], "geist", "cream", DEPOSIT_FTM, BORROW_WBTC, 0);
    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {
      testDeposit2a(
        [vaultwftmdai, vaultwftmusdc, vaultwftmweth, vaultwftmwbtc],
        DEPOSIT_FTM,
        ASSETS
      );
      testDeposit2a([vaultdaiwftm, vaultusdcwftm], DEPOSIT_STABLE, ASSETS);
      testDeposit2a(
        [vaultwethwftm, vaultwethdai, vaultwethusdc, vaultwethwbtc],
        DEPOSIT_WETH,
        ASSETS
      );
      testDeposit2a(
        [vaultwbtcwftm, vaultwbtcdai, vaultwbtcusdc, vaultwbtcweth],
        DEPOSIT_WBTC,
        ASSETS
      );

      testBorrow2([vaultwethdai, vaultwethusdc], DEPOSIT_WETH, BORROW_STABLE);
      testBorrow2([vaultwbtcdai, vaultwbtcusdc], DEPOSIT_WBTC, BORROW_STABLE);
      testBorrow2([vaultdaiwftm, vaultusdcwftm], DEPOSIT_STABLE, BORROW_FTM);
      testBorrow2([vaultdaiweth, vaultusdcweth], DEPOSIT_STABLE, BORROW_WETH);
      testBorrow2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC);

      testPaybackAndWithdraw2([vaultdaiweth, vaultusdcweth], DEPOSIT_STABLE, BORROW_WETH);
      testPaybackAndWithdraw2([vaultdaiwbtc, vaultusdcwbtc], DEPOSIT_STABLE, BORROW_WBTC);

      testRefinance2(
        [vaultwethdai, vaultwethusdc],
        "geist",
        "scream",
        DEPOSIT_WETH,
        BORROW_STABLE,
        2
      );
      testRefinance2([vaultwethwbtc], "geist", "scream", DEPOSIT_WETH, BORROW_WBTC, 2);
      testRefinance2(
        [vaultdaiweth, vaultusdcweth],
        "geist",
        "scream",
        DEPOSIT_STABLE,
        BORROW_WETH,
        2
      );
      testRefinance2(
        [vaultwethdai, vaultwethusdc],
        "geist",
        "cream",
        DEPOSIT_WETH,
        BORROW_STABLE,
        0
      );
      testRefinance2([vaultwethwbtc], "geist", "cream", DEPOSIT_WETH, BORROW_WBTC, 0);
      testRefinance2(
        [vaultdaiweth, vaultusdcweth],
        "geist",
        "cream",
        DEPOSIT_STABLE,
        BORROW_WETH,
        0
      );
    });

    describe("ERC20 token as collateral, native token as borrow asset.", function () {
      testBorrow3([vaultdaiftm], DEPOSIT_STABLE, BORROW_FTM);

      testPaybackAndWithdraw3([vaultwbtcftm], DEPOSIT_WBTC, BORROW_FTM * 0.5);
      testPaybackAndWithdraw3([vaultwethftm], DEPOSIT_WETH, BORROW_FTM * 0.5);
      testPaybackAndWithdraw3([vaultdaiftm, vaultusdcftm], DEPOSIT_STABLE, BORROW_FTM * 0.5);

      testRefinance3([vaultusdcftm, vaultdaiftm], "geist", "scream", DEPOSIT_STABLE, BORROW_FTM, 2);
      testRefinance3([vaultwbtcftm], "geist", "scream", DEPOSIT_WBTC, BORROW_FTM, 2);
      testRefinance3([vaultwethftm], "geist", "scream", DEPOSIT_WETH, BORROW_FTM, 2);
      testRefinance3([vaultusdcftm, vaultdaiftm], "geist", "cream", DEPOSIT_STABLE, BORROW_FTM, 0);
      testRefinance3([vaultwbtcftm], "geist", "cream", DEPOSIT_WBTC, BORROW_FTM, 0);
      testRefinance3([vaultwethftm], "geist", "cream", DEPOSIT_WETH, BORROW_FTM, 0);
    });
  });
});
