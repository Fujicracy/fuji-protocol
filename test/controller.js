const { expect } = require("chai");
const { formatUnitsToNum, parseUnits, timeTravel } = require("./helpers");

function testRefinance1(vaults, from, to, amountToDeposit, amountToBorrow, flashloanProvider = 1) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`refinance ${collateral.nameUp} -> ${debt.nameUp} Native token as collateral, ERC20 as borrow asset`, async function () {
      const depositAmount = parseUnits(amountToDeposit);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);

      await this.f[name]
        .connect(this.users[1])
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      let preVaultDebt = await this.f[name].borrowBalance(this.f[from].address);
      preVaultDebt = formatUnitsToNum(preVaultDebt, debt.decimals);

      let preVaultCollat = await this.f[name].depositBalance(this.f[from].address);
      preVaultCollat = formatUnitsToNum(preVaultCollat);

      await this.f.controller
        .connect(this.users[0])
        .doRefinancing(this.f[name].address, this.f[to].address, 1, 1, flashloanProvider);

      const activeProvider = await this.f[name].activeProvider();
      expect(activeProvider).to.be.eq(this.f[to].address);

      let postVaultDebt = await this.f[name].borrowBalance(this.f[to].address);
      postVaultDebt = formatUnitsToNum(postVaultDebt, debt.decimals);

      let postVaultCollat = await this.f[name].depositBalance(this.f[to].address);
      postVaultCollat = formatUnitsToNum(postVaultCollat);

      // the difference is the fee paid to flashloan provider
      // the most expensive are aave flashloans 0.09%
      await expect(preVaultDebt).to.be.closeTo(postVaultDebt, amountToBorrow * (0.0009 * 1.1));
      await expect(preVaultCollat).to.be.closeTo(postVaultCollat, 0.001);
    });
  }
}

function testRefinance2(vaults, from, to, amountToDeposit, amountToBorrow, flashloanProvider = 1) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`refinance ${collateral.nameUp} -> ${debt.nameUp} ERC20 as collateral, ERC20 as borrow asset`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);

      await this.f[collateral.name]
        .connect(this.users[1])
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.users[1]).depositAndBorrow(depositAmount, borrowAmount);

      let preVaultDebt = await this.f[name].borrowBalance(this.f[from].address);
      preVaultDebt = formatUnitsToNum(preVaultDebt, debt.decimals);

      let preVaultCollat = await this.f[name].depositBalance(this.f[from].address);
      preVaultCollat = formatUnitsToNum(preVaultCollat, collateral.decimals);

      await this.f.controller
        .connect(this.users[0])
        .doRefinancing(this.f[name].address, this.f[to].address, 1, 1, flashloanProvider);

      const activeProvider = await this.f[name].activeProvider();
      expect(activeProvider).to.be.eq(this.f[to].address);

      let postVaultDebt = await this.f[name].borrowBalance(this.f[to].address);
      postVaultDebt = formatUnitsToNum(postVaultDebt, debt.decimals);

      let postVaultCollat = await this.f[name].depositBalance(this.f[to].address);
      postVaultCollat = formatUnitsToNum(postVaultCollat, collateral.decimals);

      await expect(preVaultDebt).to.be.closeTo(postVaultDebt, 1.3);
      await expect(preVaultCollat).to.be.closeTo(postVaultCollat, 1);
    });
  }
}

function testRefinance3(vaults, from, to, amountToDeposit, amountToBorrow, flashloanProvider = 1) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`refinance ${collateral.nameUp} -> ${debt.nameUp} ERC20 as collateral, Native token as borrow asset`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow);

      await this.f[collateral.name]
        .connect(this.users[1])
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.users[1]).depositAndBorrow(depositAmount, borrowAmount);

      let preVaultDebt = await this.f[name].borrowBalance(this.f[from].address);
      preVaultDebt = formatUnitsToNum(preVaultDebt);

      let preVaultCollat = await this.f[name].depositBalance(this.f[from].address);
      preVaultCollat = formatUnitsToNum(preVaultCollat, collateral.decimals);

      await this.f.controller
        .connect(this.users[0])
        .doRefinancing(this.f[name].address, this.f[to].address, 1, 1, flashloanProvider);

      const activeProvider = await this.f[name].activeProvider();
      expect(activeProvider).to.be.eq(this.f[to].address);

      let postVaultDebt = await this.f[name].borrowBalance(this.f[to].address);
      postVaultDebt = formatUnitsToNum(postVaultDebt);

      let postVaultCollat = await this.f[name].depositBalance(this.f[to].address);
      postVaultCollat = formatUnitsToNum(postVaultCollat, collateral.decimals);

      await expect(preVaultDebt).to.be.closeTo(postVaultDebt, postVaultDebt / 100); // 1% close
      await expect(preVaultCollat).to.be.closeTo(postVaultCollat, postVaultCollat / 100); // 1% close
    });
  }
}

module.exports = {
  testRefinance1,
  testRefinance2,
  testRefinance3,
};
