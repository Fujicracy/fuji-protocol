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
  testBorrow2k,
  testBorrow3,
  testPaybackAndWithdraw1,
  testPaybackAndWithdraw2,
  testPaybackAndWithdraw2k,
  testPaybackAndWithdraw3,
  testDeposit1b,
} = require("../FujiVault");

const { testRefinance1, testRefinance2, testRefinance3 } = require("../controller");

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

const [DEPOSIT_STABLE, DEPOSIT_MATIC, DEPOSIT_WETH, DEPOSIT_WBTC] = [80, 40, 0.022, 0.0014];

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

  describe("Kashi as Provider", function () {
    before(async function () {
      evmRevert(evmSnapshot1);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.kashi.address);
      }
    });

    describe("Native token as collateral, ERC20 as borrow asset.", function () {

      // Kashi kmWMATICDAI is iliquid. 12/20/2021
      testBorrow1([vaultmaticusdc], DEPOSIT_MATIC, BORROW_STABLE);
      testPaybackAndWithdraw1([vaultmaticusdc], DEPOSIT_MATIC, BORROW_STABLE);
      testRefinance1([vaultmaticusdc], "kashi", "aave", DEPOSIT_MATIC, BORROW_STABLE, 0);

    });

    describe("ERC20 token as collateral, ERC20 as borrow asset.", function () {

      testBorrow2k([vaultwethdai, vaultwethusdc], DEPOSIT_WETH, BORROW_STABLE);
      testPaybackAndWithdraw2k([vaultwethdai, vaultwethusdc], DEPOSIT_WETH, BORROW_STABLE);
      testRefinance2([vaultwethdai], "aave", "kashi", DEPOSIT_WETH, BORROW_STABLE, 0);

    });

    // This test can only be run by modifying ProviderKashi file. 
    // It requires only one implementation of 'getBorrowRateFor'
    // describe("View Function Tests.", function () {
    //   it("Should get a valid borrowing rate", async function (){
    //     const rate = await this.f['kashi'].getBorrowRateFor(ASSETS.WETH.address,ASSETS.DAI.address);
    //     // console.log('rate', rate);
    //     await expect(rate).to.be.gt(0);
    //   });
    // });

  });
});
