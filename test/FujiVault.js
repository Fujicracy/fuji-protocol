const { ethers } = require("hardhat");
const { expect } = require("chai");

const { ASSETS } = require("./core-utils");
const {
  timeTravel,
  formatUnitsToNum,
  formatUnitsOfCurrency,
  parseUnits,
  toBN,
  checkEthChange,
  checkTokenChange,
} = require("./helpers");

const { getContractAt } = ethers;

// testing deposits in ETH
// in Compound-like providers (Compound, IronBank)
function testDeposit1(mapperAddr, vaults, amount) {
  for (let i = 0; i < vaults.length; i += 1) {
    const vault = vaults[i];
    it(`deposit ${amount} ETH as collateral, check ${vault.name} balance`, async function () {
      const fujimapper = await getContractAt("FujiMapping", mapperAddr);
      const vAssets = await this.f[vault.name].vAssets();
      const cTokenAddr = await fujimapper.addressMapping(vAssets.collateralAsset);
      const cETH = await getContractAt("ICEth", cTokenAddr);

      const depositAmount = parseUnits(amount);
      const negdepositAmount = parseUnits(-amount);

      await checkEthChange(
        this.f[vault.name].connect(this.user1).deposit(depositAmount, { value: depositAmount }),
        this.user1.address,
        negdepositAmount
      );

      let vaultBal = await cETH.balanceOf(this.f[vault.name].address);
      vaultBal = await formatUnitsOfCurrency(cETH.address, vaultBal);

      const rate = await cETH.exchangeRateStored();

      let tokenAmount = depositAmount.mul(toBN(1e18)).div(rate);
      tokenAmount = await formatUnitsOfCurrency(cETH.address, tokenAmount);

      await expect(vaultBal).to.be.equal(tokenAmount);
    });
  }
}

// testing deposits in ETH
// in Aave
function testDeposit1a(vaults, amount, aeth) {
  for (let i = 0; i < vaults.length; i += 1) {
    const vault = vaults[i];
    it(`deposit ${amount} ETH as collateral, check ${vault.name} balance`, async function () {
      const aWETH = await getContractAt("IERC20", aeth);

      const depositAmount = parseUnits(amount);
      const negdepositAmount = parseUnits(-amount);

      await checkEthChange(
        this.f[vault.name].connect(this.user1).deposit(depositAmount, { value: depositAmount }),
        this.user1.address,
        negdepositAmount
      );

      const vaultBal = await aWETH.balanceOf(this.f[vault.name].address);

      expect(vaultBal).to.be.equal(depositAmount);
    });
  }
}

// testing deposits in ETH
// in dydx
function testDeposit1b(vaults, amount) {
  for (let i = 0; i < vaults.length; i += 1) {
    const vault = vaults[i];
    it(`deposit ${amount} ETH as collateral, check ${vault.name} balance`, async function () {
      const depositAmount = parseUnits(amount);
      const negdepositAmount = parseUnits(-amount);

      await checkEthChange(
        this.f[vault.name].connect(this.user1).deposit(depositAmount, { value: depositAmount }),
        this.user1.address,
        negdepositAmount
      );

      const vaultBal = await this.f[vault.name].depositBalance(this.f.dydx.address);

      expect(vaultBal / 1).to.be.equal(depositAmount / 1, 100);
    });
  }
}

// testing deposits in ERC20
// in Compound-like providers (Compound, IronBank)
function testDeposit2(mapperAddr, vaults, amount) {
  for (let i = 0; i < vaults.length; i += 1) {
    const vault = vaults[i];
    it(`deposit ${amount} ERC20 -> ${vault.collateral.nameUp} as collateral, check ${vault.name} balance`, async function () {
      const fujimapper = await getContractAt("FujiMapping", mapperAddr);
      const vAssets = await this.f[vault.name].vAssets();
      const cTokenAddr = await fujimapper.addressMapping(vAssets.collateralAsset);
      const cToken = await getContractAt("ICErc20", cTokenAddr);

      const depositAmount = parseUnits(amount, vault.collateral.decimals);
      const negdepositAmount = parseUnits(-amount, vault.collateral.decimals);

      await this.f[vault.collateral.name]
        .connect(this.user1)
        .approve(this.f[vault.name].address, depositAmount);

      await checkTokenChange(
        this.f[vault.name].connect(this.user1).deposit(depositAmount),
        this.f[vault.collateral.name],
        this.user1.address,
        negdepositAmount
      );

      let vaultBal = await cToken.balanceOf(this.f[vault.name].address);
      vaultBal = await formatUnitsOfCurrency(cToken.address, vaultBal);

      const rate = await cToken.exchangeRateStored();

      let tokenAmount = depositAmount.mul(toBN(1e18)).div(rate);
      tokenAmount = await formatUnitsOfCurrency(cToken.address, tokenAmount);

      expect(vaultBal).to.be.equal(tokenAmount);
    });
  }
}

// testing deposits in ERC20
// in Aave
function testDeposit2a(vaults, amount, assets = ASSETS) {
  for (let i = 0; i < vaults.length; i += 1) {
    const vault = vaults[i];
    it(`deposit ${amount} ERC20 -> ${vault.collateral.nameUp} as collateral, check ${vault.name} balance`, async function () {
      const aToken = await getContractAt("IERC20", assets[vault.collateral.nameUp].aToken);

      const depositAmount = parseUnits(amount, vault.collateral.decimals);
      const negdepositAmount = parseUnits(-amount, vault.collateral.decimals);

      await this.f[vault.collateral.name]
        .connect(this.user1)
        .approve(this.f[vault.name].address, depositAmount);

      await checkTokenChange(
        this.f[vault.name].connect(this.user1).deposit(depositAmount),
        this.f[vault.collateral.name],
        this.user1.address,
        negdepositAmount
      );

      const vaultBal = await aToken.balanceOf(this.f[vault.name].address);

      expect(vaultBal).to.be.equal(depositAmount);
    });
  }
}

function testBorrow1(vaults, amountToDeposit, amountToBorrow) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`borrow ${amountToBorrow} ERC20 -> ${debt.nameUp} after depositing ${amountToDeposit} ETH as collateral`, async function () {
      const depositAmount = parseUnits(amountToDeposit);
      const negdepositAmount = parseUnits(-amountToDeposit);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);
      const { collateralID, borrowID } = await this.f[name].vAssets();
      // boostrap vault
      await this.f[name].connect(this.users[0]).deposit(depositAmount, { value: depositAmount });

      await checkEthChange(
        this.f[name].connect(this.user1).deposit(depositAmount, { value: depositAmount }),
        this.user1.address,
        negdepositAmount
      );

      await expect(await this.f.f1155.balanceOf(this.user1.address, collateralID)).to.be.equal(
        depositAmount
      );

      await checkTokenChange(
        this.f[name].connect(this.user1).borrow(borrowAmount),
        this.f[debt.name],
        this.user1.address,
        borrowAmount
      );
      await expect(await this.f.f1155.balanceOf(this.user1.address, borrowID)).to.be.equal(
        borrowAmount
      );
    });
  }
}

function testBorrow2(vaults, amountToDeposit, amountToBorrow) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`borrow ${amountToBorrow} ERC20 -> ${debt.nameUp} after depositing ${amountToDeposit} ERC20 -> ${collateral.nameUp} as collateral`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const negdepositAmount = parseUnits(-amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);
      const { collateralID, borrowID } = await this.f[name].vAssets();

      await this.f[collateral.name]
        .connect(this.user1)
        .approve(this.f[name].address, depositAmount);
      await checkTokenChange(
        this.f[name].connect(this.user1).deposit(depositAmount),
        this.f[collateral.name],
        this.user1.address,
        negdepositAmount
      );
      await expect(await this.f.f1155.balanceOf(this.user1.address, collateralID)).to.be.equal(
        depositAmount
      );

      await checkTokenChange(
        this.f[name].connect(this.user1).borrow(borrowAmount),
        this.f[debt.name],
        this.user1.address,
        borrowAmount
      );
      await expect(await this.f.f1155.balanceOf(this.user1.address, borrowID)).to.be.equal(
        borrowAmount
      );
    });
  }
}

function testBorrow2k(vaults, amountToDeposit, amountToBorrow) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`borrow ${amountToBorrow} ERC20 -> ${debt.nameUp} after depositing ${amountToDeposit} ERC20 -> ${collateral.nameUp} as collateral`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const negdepositAmount = parseUnits(-amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);
      const { collateralID, borrowID } = await this.f[name].vAssets();

      await this.f[collateral.name]
        .connect(this.user1)
        .approve(this.f[name].address, depositAmount);
      await checkTokenChange(
        this.f[name].connect(this.user1).deposit(depositAmount),
        this.f[collateral.name],
        this.user1.address,
        negdepositAmount
      );
      await expect(await this.f.f1155.balanceOf(this.user1.address, collateralID)).to.be.equal(
        depositAmount
      );

      const balanceBefore = await this.f[debt.name].balanceOf(this.user1.address);

      await this.f[name].connect(this.user1).borrow(borrowAmount);

      const balanceAfter = await this.f[debt.name].balanceOf(this.user1.address);

      expect(balanceAfter.sub(balanceBefore)).to.closeTo(borrowAmount, 1);

      await expect(await this.f.f1155.balanceOf(this.user1.address, borrowID)).to.be.closeTo(
        borrowAmount,
        1
      );
    });
  }
}

function testBorrow3(vaults, amountToDeposit, amountToBorrow) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`borrow ${amountToBorrow} ETH after depositing ${amountToDeposit} ERC20 -> ${collateral.nameUp} as collateral`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const negdepositAmount = parseUnits(-amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow);
      const { collateralID, borrowID } = await this.f[name].vAssets();

      await this.f[collateral.name]
        .connect(this.user1)
        .approve(this.f[name].address, depositAmount);
      await checkTokenChange(
        this.f[name].connect(this.user1).deposit(depositAmount),
        this.f[collateral.name],
        this.user1.address,
        negdepositAmount
      );

      await expect(await this.f.f1155.balanceOf(this.user1.address, collateralID)).to.be.equal(
        depositAmount
      );

      await checkEthChange(
        this.f[name].connect(this.user1).borrow(borrowAmount),
        this.user1.address,
        borrowAmount
      );

      await expect(await this.f.f1155.balanceOf(this.user1.address, borrowID)).to.be.equal(
        borrowAmount
      );
    });
  }
}

function testPaybackAndWithdraw1(vaults, amountToDeposit, amountToBorrow) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`payback ${amountToBorrow} ERC20 -> ${debt.nameUp} and withdraw ${amountToDeposit} ETH`, async function () {
      const depositAmount = parseUnits(amountToDeposit);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);
      const one = parseUnits(1, debt.decimals);
      const negborrowAmount = parseUnits(-amountToBorrow, debt.decimals);
      const { collateralID, borrowID } = await this.f[name].vAssets();
      // boostrap vault
      await this.f[name].connect(this.users[0]).deposit(depositAmount, { value: depositAmount });

      for (let x = 1; x < 4; x += 1) {
        await this.f[name]
          .connect(this.users[x])
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
        await timeTravel(60);
      }

      for (let x = 1; x < 4; x += 1) {
        await this.f[debt.name].connect(this.users[x]).approve(this.f[name].address, borrowAmount);
        await timeTravel(60);
        await checkTokenChange(
          this.f[name].connect(this.users[x]).payback(borrowAmount),
          this.f[debt.name],
          this.users[x].address,
          negborrowAmount
        );
        await expect(await this.f.f1155.balanceOf(this.users[x].address, borrowID)).to.be.lt(one);
      }

      for (let x = 1; x < 4; x += 1) {
        await this.f[name].connect(this.users[x]).withdraw(-1);
        await timeTravel(60);
        await expect(await this.f.f1155.balanceOf(this.users[x].address, collateralID)).to.be.lt(
          1e15
        );
      }
    });
  }
}

function testPaybackAndWithdraw2(vaults, amountToDeposit, amountToBorrow) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`payback ${amountToBorrow} ERC20 -> ${debt.nameUp} and withdraw ${amountToDeposit} ERC20 -> ${collateral.nameUp}`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);
      const negborrowAmount = parseUnits(-amountToBorrow, debt.decimals);
      const { collateralID, borrowID } = await this.f[name].vAssets();
      // boostrap vault
      await this.f[collateral.name]
        .connect(this.users[0])
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.users[0]).deposit(depositAmount);

      for (let x = 1; x < 4; x += 1) {
        await this.f[collateral.name]
          .connect(this.users[x])
          .approve(this.f[name].address, depositAmount);
        await this.f[name].connect(this.users[x]).depositAndBorrow(depositAmount, borrowAmount);
      }

      const oneDebt = parseUnits(1, debt.decimals);
      for (let x = 1; x < 4; x += 1) {
        await this.f[debt.name].connect(this.users[x]).approve(this.f[name].address, borrowAmount);
        await timeTravel(60);
        await checkTokenChange(
          this.f[name].connect(this.users[x]).payback(borrowAmount),
          this.f[debt.name],
          this.users[x].address,
          negborrowAmount
        );
        await expect(await this.f.f1155.balanceOf(this.users[x].address, borrowID)).to.be.lt(
          oneDebt
        );
      }

      const oneCol = parseUnits(1, collateral.decimals);
      for (let x = 1; x < 4; x += 1) {
        await this.f[name].connect(this.users[x]).withdraw(-1);
        await timeTravel(60);
        await expect(await this.f.f1155.balanceOf(this.users[x].address, collateralID)).to.be.lt(
          oneCol
        );
      }
    });
  }
}

function testPaybackAndWithdraw2k(vaults, amountToDeposit, amountToBorrow) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`payback ${amountToBorrow} ERC20 -> ${debt.nameUp} and withdraw ${amountToDeposit} ERC20 -> ${collateral.nameUp}`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow, debt.decimals);
      const { collateralID, borrowID } = await this.f[name].vAssets();
      // boostrap vault
      await this.f[collateral.name]
        .connect(this.users[0])
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.users[0]).deposit(depositAmount);

      const borrowedAmount = {};
      for (let x = 1; x < 4; x += 1) {
        await this.f[collateral.name]
          .connect(this.users[x])
          .approve(this.f[name].address, depositAmount);
        await this.f[name].connect(this.users[x]).depositAndBorrow(depositAmount, borrowAmount);

        borrowedAmount[x] = await this.f.f1155.balanceOf(this.users[x].address, borrowID);
      }

      const oneDebt = parseUnits(1, debt.decimals);
      for (let x = 1; x < 4; x += 1) {
        await this.f[debt.name]
          .connect(this.users[x])
          .approve(this.f[name].address, borrowedAmount[x]);
        await timeTravel(60);
        await checkTokenChange(
          this.f[name].connect(this.users[x]).payback(borrowedAmount[x]),
          this.f[debt.name],
          this.users[x].address,
          ethers.BigNumber.from("0").sub(borrowedAmount[x])
        );
        await expect(await this.f.f1155.balanceOf(this.users[x].address, borrowID)).to.be.lt(
          oneDebt
        );
      }

      const oneCol = parseUnits(1, collateral.decimals);
      for (let x = 1; x < 4; x += 1) {
        await this.f[name].connect(this.users[x]).withdraw(-1);
        await timeTravel(60);
        await expect(await this.f.f1155.balanceOf(this.users[x].address, collateralID)).to.be.lt(
          oneCol
        );
      }
    });
  }
}

function testPaybackAndWithdraw3(vaults, amountToDeposit, amountToBorrow) {
  for (let i = 0; i < vaults.length; i += 1) {
    const { name, collateral, debt } = vaults[i];
    it(`payback ETH and withdraw ERC20 -> ${collateral.nameUp}`, async function () {
      const depositAmount = parseUnits(amountToDeposit, collateral.decimals);
      const borrowAmount = parseUnits(amountToBorrow);
      const negborrowAmount = parseUnits(-amountToBorrow);
      const { collateralID, borrowID } = await this.f[name].vAssets();
      // boostrap vault
      await this.f[collateral.name]
        .connect(this.users[0])
        .approve(this.f[name].address, depositAmount);
      await this.f[name].connect(this.users[0]).deposit(depositAmount);

      for (let x = 1; x < 4; x += 1) {
        await this.f[collateral.name]
          .connect(this.users[x])
          .approve(this.f[name].address, depositAmount);
        await timeTravel(60);
        await this.f[name].connect(this.users[x]).depositAndBorrow(depositAmount, borrowAmount);
      }

      const fractionDebt = parseUnits(1, 16);
      for (let x = 1; x < 4; x += 1) {
        await checkEthChange(
          this.f[name].connect(this.users[x]).payback(borrowAmount, { value: borrowAmount }),
          this.users[x].address,
          negborrowAmount
        );
        await timeTravel(60);
        await expect(await this.f.f1155.balanceOf(this.users[x].address, borrowID)).to.be.lt(
          fractionDebt
        );
      }

      const oneCol = parseUnits(1, collateral.decimals);
      for (let x = 1; x < 4; x += 1) {
        await this.f[name].connect(this.users[x]).withdraw(-1);
        await timeTravel(60);
        await expect(await this.f.f1155.balanceOf(this.users[x].address, collateralID)).to.be.lt(
          oneCol
        );
      }
    });
  }
}

module.exports = {
  testDeposit1,
  testDeposit1a,
  testDeposit1b,
  testDeposit2,
  testDeposit2a,
  testBorrow1,
  testBorrow2,
  testBorrow2k,
  testBorrow3,
  testPaybackAndWithdraw1,
  testPaybackAndWithdraw2,
  testPaybackAndWithdraw2k,
  testPaybackAndWithdraw3,
};
