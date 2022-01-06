const { ethers } = require("hardhat");
const { expect } = require("chai");
const { formatUnitsToNum, parseUnits, timeTravel } = require("./helpers");
const { provider } = ethers;

function testFlashClose1(vaults, amountToDeposit, amountToBorrow, flashLoanProvider) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`flashClose ${amountToBorrow} ${debt.nameUp} after depositing ${amountToDeposit} ETH as collateral`, async function () {
      const depositAmount = parseUnits(amountToDeposit);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);
      const { collateralID, borrowID } = await this.f[name].vAssets();
      // boostrap vault
      await this.f[name].connect(this.owner).deposit(depositAmount, { value: depositAmount });

      await this.f[name]
        .connect(this.user1)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      await expect(await this.f.f1155.balanceOf(this.user1.address, collateralID)).to.be.gte(
        depositAmount
      );
      await expect(await this.f.f1155.balanceOf(this.user1.address, borrowID)).to.be.gte(
        borrowAmount
      );

      await this.f.fliquidator
        .connect(this.user1)
        .flashClose(-1, this.f[name].address, flashLoanProvider);

      await expect(await this.f.f1155.balanceOf(this.user1.address, collateralID)).to.be.equal(0);
      await expect(await this.f.f1155.balanceOf(this.user1.address, borrowID)).to.be.equal(0);
    });
  }
}

function testFlashClose2(vaults, amountToDeposit, amountToBorrow, flashLoanProvider) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`flashClose ${amountToBorrow} ${debt.nameUp} after depositing ${amountToDeposit} ${collateral.nameUp} as collateral`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);
      const negborrowAmount = parseUnits(-amountToBorrow, debt.decimals);
      const { collateralID, borrowID } = await this.f[name].vAssets();
      // boostrap vault
      await this.f[collateral.name]
        .connect(this.owner)
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.owner).deposit(depositAmount);

      await this.f[collateral.name]
        .connect(this.user1)
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.user1).depositAndBorrow(depositAmount, borrowAmount);

      await expect(await this.f.f1155.balanceOf(this.user1.address, collateralID)).to.be.gte(
        depositAmount
      );
      await expect(await this.f.f1155.balanceOf(this.user1.address, borrowID)).to.be.gte(
        borrowAmount
      );

      const userBalBefore = await this.f[collateral.name].balanceOf(this.user1.address);

      await this.f.fliquidator
        .connect(this.user1)
        .flashClose(-1, this.f[name].address, flashLoanProvider);

      const userBalAfter = await this.f[collateral.name].balanceOf(this.user1.address);

      await expect(await this.f.f1155.balanceOf(this.user1.address, collateralID)).to.be.equal(0);
      await expect(await this.f.f1155.balanceOf(this.user1.address, borrowID)).to.be.equal(0);
      expect(userBalAfter).to.be.gt(userBalBefore);
    });
  }
}

function testFlashClose3(vaults, amountToDeposit, amountToBorrow, flashLoanProvider) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`flashClose ${amountToBorrow} ${debt.nameUp} after depositing ${amountToDeposit} ${collateral.nameUp} as collateral`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow);
      const negborrowAmount = parseUnits(-amountToBorrow);
      const { collateralID, borrowID } = await this.f[name].vAssets();
      // boostrap vault
      await this.f[collateral.name]
        .connect(this.owner)
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.owner).deposit(depositAmount);

      await this.f[collateral.name]
        .connect(this.user1)
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.user1).depositAndBorrow(depositAmount, borrowAmount);

      await expect(await this.f.f1155.balanceOf(this.user1.address, collateralID)).to.be.gte(
        depositAmount
      );
      await expect(await this.f.f1155.balanceOf(this.user1.address, borrowID)).to.be.gte(
        borrowAmount
      );

      const userBalBefore = await this.f[collateral.name].balanceOf(this.user1.address);

      await this.f.fliquidator
        .connect(this.user1)
        .flashClose(-1, this.f[name].address, flashLoanProvider);

      const userBalAfter = await this.f[collateral.name].balanceOf(this.user1.address);

      await expect(await this.f.f1155.balanceOf(this.user1.address, collateralID)).to.be.equal(0);
      await expect(await this.f.f1155.balanceOf(this.user1.address, borrowID)).to.be.equal(0);
      expect(userBalAfter).to.be.gt(userBalBefore);
    });
  }
}

module.exports = {
  testFlashClose1,
  testFlashClose2,
  testFlashClose3,
};
