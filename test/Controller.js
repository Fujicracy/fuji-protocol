const { expect } = require("chai");
const { formatUnitsToNum, parseUnits, timeTravel } = require("./helpers");

const DEBUG = false;

/**
 * Performs refinancing test; native token must be collateral type, and ERC20 the borrow asset.
 * @param {array} vaults - An array of vault objects
 * @param {string} from - Name of the provider as defined in utils.js.
 * @param {string} to - Name of the provider as defined in utils.js.
 * @param {object} amountToDeposit - Etherjs compatible BigNumber.
 * @param {object} amountToBorrow - Etherjs compatible BigNumber.
 * @param {object} flashloanProvider - Flashloan provider.
 */
function testRefinance1(vaults, from, to, amountToDeposit, amountToBorrow, flashloanProvider = 1) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`refinance ${collateral.nameUp} -> ${debt.nameUp} Native token as collateral, ERC20 as borrow asset`, async function () {
      const depositAmount = parseUnits(amountToDeposit);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);

      await this.f[name].connect(this.users[0]).setActiveProvider(this.f[from].address);

      await this.f[name]
        .connect(this.users[1])
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      
      if (DEBUG) {
        console.log('testRefinance1, Step1');
      }

      let preVaultDebt = await this.f[name].borrowBalance(this.f[from].address);
      preVaultDebt = formatUnitsToNum(preVaultDebt, debt.decimals);

      let preVaultCollat = await this.f[name].depositBalance(this.f[from].address);
      preVaultCollat = formatUnitsToNum(preVaultCollat);

      await this.f.controller
        .connect(this.users[0])
        .doRefinancing(this.f[name].address, this.f[to].address, flashloanProvider);
      if (DEBUG) {
        console.log('testRefinance1, Step2');
      }

      const activeProvider = await this.f[name].activeProvider();
      expect(activeProvider).to.be.eq(this.f[to].address);
      if (DEBUG) {
        console.log('testRefinance1, Step3');
      }

      let postVaultDebt = await this.f[name].borrowBalance(this.f[to].address);
      postVaultDebt = formatUnitsToNum(postVaultDebt, debt.decimals);

      let postVaultCollat = await this.f[name].depositBalance(this.f[to].address);
      postVaultCollat = formatUnitsToNum(postVaultCollat);

      // the difference is the fee paid to flashloan provider
      // the most expensive are aave flashloans 0.09%
      await expect(preVaultDebt).to.be.closeTo(postVaultDebt, amountToBorrow * (0.0009 * 1.1));
      if (DEBUG) {
        console.log('testRefinance1, Step4');
      }
      await expect(preVaultCollat).to.be.closeTo(postVaultCollat, 0.001);
    });
  }
}

/**
 * Performs refinancing test; ERC20 must be collateral type, and ERC20 the borrow asset.
 * @param {array} vaults - An array of vault objects
 * @param {string} from - Name of the provider as defined in utils.js.
 * @param {string} to - Name of the provider as defined in utils.js.
 * @param {object} amountToDeposit - Etherjs compatible BigNumber.
 * @param {object} amountToBorrow - Etherjs compatible BigNumber.
 * @param {object} flashloanProvider - Flashloan provider.
 */
function testRefinance2(vaults, from, to, amountToDeposit, amountToBorrow, flashloanProvider = 1) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`refinance ${collateral.nameUp} -> ${debt.nameUp} ERC20 as collateral, ERC20 as borrow asset`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);

      await this.f[name].connect(this.users[0]).setActiveProvider(this.f[from].address);

      await this.f[collateral.name]
        .connect(this.users[1])
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.users[1]).depositAndBorrow(depositAmount, borrowAmount);
      if (DEBUG) {
        console.log('testRefinance2, Step1');
      }

      let preVaultDebt = await this.f[name].borrowBalance(this.f[from].address);
      preVaultDebt = formatUnitsToNum(preVaultDebt, debt.decimals);

      let preVaultCollat = await this.f[name].depositBalance(this.f[from].address);
      preVaultCollat = formatUnitsToNum(preVaultCollat, collateral.decimals);

      await this.f.controller
        .connect(this.users[0])
        .doRefinancing(this.f[name].address, this.f[to].address, flashloanProvider);
      if (DEBUG) {
        console.log('testRefinance2, Step2');
      }

      const activeProvider = await this.f[name].activeProvider();
      expect(activeProvider).to.be.eq(this.f[to].address);
      if ( DEBUG ) {
        console.log('testRefinance2, Step3');
      }

      let postVaultDebt = await this.f[name].borrowBalance(this.f[to].address);
      postVaultDebt = formatUnitsToNum(postVaultDebt, debt.decimals);

      let postVaultCollat = await this.f[name].depositBalance(this.f[to].address);
      postVaultCollat = formatUnitsToNum(postVaultCollat, collateral.decimals);

      await expect(preVaultDebt).to.be.closeTo(postVaultDebt, 1.3);
      if (DEBUG) {
        console.log('testRefinance2, Step4');
      }
      await expect(preVaultCollat).to.be.closeTo(postVaultCollat, 1);
    });
  }
}

/**
 * Performs refinancing test; ERC20 must be collateral type, and native token the borrow asset.
 * @param {array} vaults - An array of vault objects
 * @param {string} from - Name of the provider as defined in utils.js.
 * @param {string} to - Name of the provider as defined in utils.js.
 * @param {object} amountToDeposit - Etherjs compatible BigNumber.
 * @param {object} amountToBorrow - Etherjs compatible BigNumber.
 * @param {object} flashloanProvider - Flashloan provider.
 */
function testRefinance3(vaults, from, to, amountToDeposit, amountToBorrow, flashloanProvider = 1) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`refinance ${collateral.nameUp} -> ${debt.nameUp} ERC20 as collateral, Native token as borrow asset`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow);

      await this.f[name].connect(this.users[0]).setActiveProvider(this.f[from].address);

      await this.f[collateral.name]
        .connect(this.users[1])
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.users[1]).depositAndBorrow(depositAmount, borrowAmount);
      if (DEBUG) {
        console.log('testRefinance2, Step1');
      }

      let preVaultDebt = await this.f[name].borrowBalance(this.f[from].address);
      preVaultDebt = formatUnitsToNum(preVaultDebt);

      let preVaultCollat = await this.f[name].depositBalance(this.f[from].address);
      preVaultCollat = formatUnitsToNum(preVaultCollat, collateral.decimals);

      await this.f.controller
        .connect(this.users[0])
        .doRefinancing(this.f[name].address, this.f[to].address, flashloanProvider);
      if (DEBUG) {
        console.log('testRefinance2, Step2');
      }

      const activeProvider = await this.f[name].activeProvider();
      expect(activeProvider).to.be.eq(this.f[to].address);
      if (DEBUG) {
        console.log('testRefinance2, Step3');
      }

      let postVaultDebt = await this.f[name].borrowBalance(this.f[to].address);
      postVaultDebt = formatUnitsToNum(postVaultDebt);

      let postVaultCollat = await this.f[name].depositBalance(this.f[to].address);
      postVaultCollat = formatUnitsToNum(postVaultCollat, collateral.decimals);

      await expect(preVaultDebt).to.be.closeTo(postVaultDebt, postVaultDebt / 100); // 1% close
      if (DEBUG) {
        console.log('testRefinance2, Step4');
      }
      await expect(preVaultCollat).to.be.closeTo(postVaultCollat, postVaultCollat / 100); // 1% close
    });
  }
}

module.exports = {
  testRefinance1,
  testRefinance2,
  testRefinance3,
};
