const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");
const { getContractAt, provider } = ethers;

const {
  formatUnitsOfCurrency,
  formatUnitsToNum,
  parseUnits,
  toBN,
  evmSnapshot,
  evmRevert,
  ZERO_ADDR,
} = require("./helpers");
const { fixture, ASSETS, VAULTS } = require("./fuse-utils.js");

const fuseAddrs = {
  fuse3Comptroller: "0x6E7fb6c5865e8533D5ED31b6d43fD95f4C411834",
  fuse6Comptroller: "0x814b02C1ebc9164972D888495927fe1697F0Fb4c",
  fuse7Comptroller: "0xFB558eCD2D24886e8d2956775C619deb22f154EF",
  fuse8Comptroller: "0xc54172e34046c1653d1920d40333Dd358c7a1aF4",
  fuse18Comptroller: "0x621579DD26774022F33147D3852ef4E00024b763",
};
const _vaults = {};
for (const v of VAULTS) {
  _vaults[v.name] = v;
}
const {
  vaultethdai,
  vaultethusdc,
  vaultdaiusdc,
  vaultusdcdai,
  vaultdaiusdt,
  vaultdaieth,
  vaultethfei,
  vaultfeieth,
  vaultfeiusdc,
  vaultusdcfei,
  vaultdaifei,
  vaultfeidai,
} = _vaults;

const [DEPOSIT_ERC20, BORROW_ERC20, DEPOSIT_ETH, BORROW_ETH] = [7000, 2500, 5, 1];

describe("Rari Fuse", function () {
  let f;

  let users;
  let user1;

  let evmSnapshot0;
  let evmSnapshot1;
  let evmSnapshot2;

  before(async function () {
    users = await ethers.getSigners();
    user1 = users[1];

    const loadFixture = createFixtureLoader(users, provider);
    f = await loadFixture(fixture);
    evmSnapshot0 = await evmSnapshot();

    for (let x = 0; x < 4; x += 1) {
      const block = await provider.getBlock();
      await f.swapper
        .connect(users[x])
        .swapETHForExactTokens(
          parseUnits(10000),
          [ASSETS.WETH.address, ASSETS.DAI.address],
          users[x].address,
          block.timestamp + x + 1,
          { value: parseUnits(10) }
        );
    }
    for (let x = 0; x < 4; x += 1) {
      const block = await provider.getBlock();
      await f.swapper
        .connect(users[x])
        .swapETHForExactTokens(
          10000e6,
          [ASSETS.WETH.address, ASSETS.USDC.address],
          users[x].address,
          block.timestamp + x + 1,
          { value: parseUnits(10) }
        );
    }
    for (let x = 0; x < 4; x += 1) {
      const block = await provider.getBlock();
      await f.swapper
        .connect(users[x])
        .swapETHForExactTokens(
          parseUnits(10000),
          [ASSETS.WETH.address, ASSETS.FEI.address],
          users[x].address,
          block.timestamp + x + 1,
          { value: parseUnits(10) }
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

  function testDeposit1(ctrlAddr, vaults) {
    for (let i = 0; i < vaults.length; i += 1) {
      const vault = vaults[i];
      it(`deposit ETH as collateral, check ${vault.name} balanace`, async () => {
        const fuseComptroller = await getContractAt("IFuseComptroller", ctrlAddr);
        const cTokenAddr = await fuseComptroller.cTokensByUnderlying(ZERO_ADDR);
        const cETH = await getContractAt("ICEth", cTokenAddr);

        const depositAmount = parseUnits(DEPOSIT_ETH);
        const negdepositAmount = parseUnits(-DEPOSIT_ETH);

        await expect(
          await f[vault.name].connect(user1).deposit(depositAmount, { value: depositAmount })
        ).to.changeEtherBalance(user1, negdepositAmount);

        let vaultBal = await cETH.balanceOf(f[vault.name].address);
        vaultBal = await formatUnitsOfCurrency(cETH.address, vaultBal);

        const rate = await cETH.exchangeRateStored();

        let tokenAmount = depositAmount.mul(toBN(1e18)).div(rate);
        tokenAmount = await formatUnitsOfCurrency(cETH.address, tokenAmount);

        await expect(vaultBal).to.be.equal(tokenAmount);
      });
    }
  }

  function testDeposit2(ctrlAddr, vaults) {
    for (let i = 0; i < vaults.length; i += 1) {
      const { name, collateral, debt } = vaults[i];
      it(`deposit ERC20 -> ${collateral.nameUp} as collateral, check ${name} balanace`, async () => {
        const fuseComptroller = await getContractAt("IFuseComptroller", ctrlAddr);

        const cTokenAddr = await fuseComptroller.cTokensByUnderlying(collateral.address);
        const cToken = await getContractAt("ICErc20", cTokenAddr);

        const depositAmount = parseUnits(DEPOSIT_ERC20, collateral.decimals);
        const negdepositAmount = parseUnits(-DEPOSIT_ERC20, collateral.decimals);

        await f[collateral.name].connect(user1).approve(f[name].address, depositAmount);
        await expect(() => f[name].connect(user1).deposit(depositAmount)).to.changeTokenBalance(
          f[collateral.name],
          user1,
          negdepositAmount
        );

        let vaultBal = await cToken.balanceOf(f[name].address);
        vaultBal = await formatUnitsOfCurrency(cToken.address, vaultBal);

        const rate = await cToken.exchangeRateStored();

        let tokenAmount = depositAmount.mul(toBN(1e18)).div(rate);
        tokenAmount = await formatUnitsOfCurrency(cToken.address, tokenAmount);

        await expect(vaultBal).to.be.equal(tokenAmount);
      });
    }
  }

  function testBorrow1(vaults) {
    for (let i = 0; i < vaults.length; i += 1) {
      const { name, collateral, debt } = vaults[i];
      it(`borrow ERC20 -> ${debt.nameUp} after depositing ETH as collateral`, async () => {
        const depositAmount = parseUnits(DEPOSIT_ETH);
        const negdepositAmount = parseUnits(-DEPOSIT_ETH);
        const borrowAmount = parseUnits(BORROW_ERC20, debt.decimals);
        const { collateralID, borrowID } = await f[name].vAssets();

        await expect(
          await f[name].connect(user1).deposit(depositAmount, { value: depositAmount })
        ).to.changeEtherBalance(user1, negdepositAmount);
        await expect(await f.f1155.balanceOf(user1.address, collateralID)).to.be.equal(
          depositAmount
        );

        await expect(() => f[name].connect(user1).borrow(borrowAmount)).to.changeTokenBalance(
          f[debt.name],
          user1,
          borrowAmount
        );
        await expect(await f.f1155.balanceOf(user1.address, borrowID)).to.be.equal(borrowAmount);
      });
    }
  }

  function testBorrow2(vaults) {
    for (let i = 0; i < vaults.length; i += 1) {
      const { name, collateral, debt } = vaults[i];
      it(`borrow ERC20 -> ${debt.nameUp} after depositing ERC20 -> ${collateral.nameUp} as collateral`, async () => {
        const depositAmount = parseUnits(DEPOSIT_ERC20, collateral.decimals);
        const negdepositAmount = parseUnits(-DEPOSIT_ERC20, collateral.decimals);
        const borrowAmount = parseUnits(BORROW_ERC20, debt.decimals);
        const { collateralID, borrowID } = await f[name].vAssets();

        await f[collateral.name].connect(user1).approve(f[name].address, depositAmount);
        await expect(() => f[name].connect(user1).deposit(depositAmount)).to.changeTokenBalance(
          f[collateral.name],
          user1,
          negdepositAmount
        );
        await expect(await f.f1155.balanceOf(user1.address, collateralID)).to.be.equal(
          depositAmount
        );

        await expect(() => f[name].connect(user1).borrow(borrowAmount)).to.changeTokenBalance(
          f[debt.name],
          user1,
          borrowAmount
        );
        await expect(await f.f1155.balanceOf(user1.address, borrowID)).to.be.equal(borrowAmount);
      });
    }
  }

  function testBorrow3(vaults) {
    for (let i = 0; i < vaults.length; i += 1) {
      const { name, collateral, debt } = vaults[i];
      it(`borrow ETH after depositing ERC20 -> ${collateral.nameUp} as collateral`, async () => {
        const depositAmount = parseUnits(DEPOSIT_ERC20, collateral.decimals);
        const negdepositAmount = parseUnits(-DEPOSIT_ERC20, collateral.decimals);
        const borrowAmount = parseUnits(BORROW_ETH);
        const { collateralID, borrowID } = await f[name].vAssets();

        await f[collateral.name].connect(user1).approve(f[name].address, depositAmount);
        await expect(() => f[name].connect(user1).deposit(depositAmount)).to.changeTokenBalance(
          f[collateral.name],
          user1,
          negdepositAmount
        );
        await expect(await f.f1155.balanceOf(user1.address, collateralID)).to.be.equal(
          depositAmount
        );

        await expect(await f[name].connect(user1).borrow(borrowAmount)).to.changeEtherBalance(
          user1,
          borrowAmount
        );
        await expect(await f.f1155.balanceOf(user1.address, borrowID)).to.be.equal(borrowAmount);
      });
    }
  }

  function testPaybackAndWithdraw1(vaults) {
    for (let i = 0; i < vaults.length; i += 1) {
      const { name, collateral, debt } = vaults[i];
      it(`payback ERC20 -> ${debt.nameUp} and withdraw ETH`, async function () {
        const depositAmount = parseUnits(DEPOSIT_ETH);
        const borrowAmount = parseUnits(BORROW_ERC20, debt.decimals);
        const one = parseUnits(1, debt.decimals);
        const negborrowAmount = parseUnits(-BORROW_ERC20, debt.decimals);
        const { collateralID, borrowID } = await f[name].vAssets();
        // boostrap vault
        await f[name].connect(users[0]).deposit(depositAmount, { value: depositAmount });

        for (let x = 1; x < 4; x += 1) {
          await f[name]
            .connect(users[x])
            .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
        }

        for (let x = 1; x < 4; x += 1) {
          await f[debt.name].connect(users[x]).approve(f[name].address, borrowAmount);
          await expect(() => f[name].connect(users[x]).payback(borrowAmount)).to.changeTokenBalance(
            f[debt.name],
            users[x],
            negborrowAmount
          );
          await expect(await f.f1155.balanceOf(users[x].address, borrowID)).to.be.lt(one);
        }

        for (let x = 1; x < 4; x += 1) {
          await f[name].connect(users[x]).withdraw(-1);
          await expect(await f.f1155.balanceOf(users[x].address, collateralID)).to.be.lt(1e13);
        }
      });
    }
  }

  function testPaybackAndWithdraw2(vaults) {
    for (let i = 0; i < vaults.length; i += 1) {
      const { name, collateral, debt } = vaults[i];
      it(`payback ERC20 -> ${debt.nameUp} and withdraw ERC20 -> ${collateral.nameUp}`, async () => {
        const depositAmount = parseUnits(DEPOSIT_ERC20, collateral.decimals);
        const borrowAmount = parseUnits(BORROW_ERC20, debt.decimals);
        const negborrowAmount = parseUnits(-BORROW_ERC20, debt.decimals);
        const { collateralID, borrowID } = await f[name].vAssets();
        // boostrap vault
        await f[collateral.name].connect(users[0]).approve(f[name].address, depositAmount);
        await f[name].connect(users[0]).deposit(depositAmount);

        for (let x = 1; x < 4; x += 1) {
          await f[collateral.name].connect(users[x]).approve(f[name].address, depositAmount);
          await f[name].connect(users[x]).depositAndBorrow(depositAmount, borrowAmount);
        }

        const oneDebt = parseUnits(1, debt.decimals);
        for (let x = 1; x < 4; x += 1) {
          await f[debt.name].connect(users[x]).approve(f[name].address, borrowAmount);
          await expect(() => f[name].connect(users[x]).payback(borrowAmount)).to.changeTokenBalance(
            f[debt.name],
            users[x],
            negborrowAmount
          );
          await expect(await f.f1155.balanceOf(users[x].address, borrowID)).to.be.lt(oneDebt);
        }

        const oneCol = parseUnits(1, collateral.decimals);
        for (let x = 1; x < 4; x += 1) {
          await f[name].connect(users[x]).withdraw(-1);
          await expect(await f.f1155.balanceOf(users[x].address, collateralID)).to.be.lt(oneCol);
        }
      });
    }
  }

  function testPaybackAndWithdraw3(vaults) {
    for (let i = 0; i < vaults.length; i += 1) {
      const { name, collateral, debt } = vaults[i];
      it(`payback ETH and withdraw ERC20 -> ${collateral.nameUp}`, async () => {
        const depositAmount = parseUnits(DEPOSIT_ERC20, collateral.decimals);
        const borrowAmount = parseUnits(BORROW_ETH);
        const negborrowAmount = parseUnits(-BORROW_ETH);
        const { collateralID, borrowID } = await f[name].vAssets();
        // boostrap vault
        await f[collateral.name].connect(users[0]).approve(f[name].address, depositAmount);
        await f[name].connect(users[0]).deposit(depositAmount);

        for (let x = 1; x < 4; x += 1) {
          await f[collateral.name].connect(users[x]).approve(f[name].address, depositAmount);
          await f[name].connect(users[x]).depositAndBorrow(depositAmount, borrowAmount);
        }

        const fractionDebt = parseUnits(1, 16);
        for (let x = 1; x < 4; x += 1) {
          await expect(
            await f[name].connect(users[x]).payback(borrowAmount, { value: borrowAmount })
          ).to.changeEtherBalance(users[x], negborrowAmount);
          await expect(await f.f1155.balanceOf(users[x].address, borrowID)).to.be.lt(fractionDebt);
        }

        const oneCol = parseUnits(1, collateral.decimals);
        for (let x = 1; x < 4; x += 1) {
          await f[name].connect(users[x]).withdraw(-1);
          await expect(await f.f1155.balanceOf(users[x].address, collateralID)).to.be.lt(oneCol);
        }
      });
    }
  }

  function testRefinance1(vaults, from, to, flashloanProvider = 1) {
    for (let i = 0; i < vaults.length; i += 1) {
      const { name, collateral, debt } = vaults[i];
      it(`refinance ERC20 -> ${debt.nameUp} debt with ETH as collateral`, async () => {
        const depositAmount = parseUnits(3);
        const borrowAmount = parseUnits(BORROW_ERC20, debt.decimals);

        await f[name]
          .connect(users[1])
          .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

        let preVaultDebt = await f[name].borrowBalance(f[from].address);
        preVaultDebt = formatUnitsToNum(preVaultDebt, debt.decimals);

        let preVaultCollat = await f[name].depositBalance(f[from].address);
        preVaultCollat = formatUnitsToNum(preVaultCollat);

        await f.controller
          .connect(users[0])
          .doRefinancing(f[name].address, f[to].address, flashloanProvider);

        let postVaultDebt = await f[name].borrowBalance(f[to].address);
        postVaultDebt = formatUnitsToNum(postVaultDebt, debt.decimals);

        let postVaultCollat = await f[name].depositBalance(f[to].address);
        postVaultCollat = formatUnitsToNum(postVaultCollat);

        await expect(preVaultDebt).to.be.closeTo(postVaultDebt, 1.3);
        await expect(preVaultCollat).to.be.closeTo(postVaultCollat, 0.001);
      });
    }
  }

  function testRefinance2(vaults, from, to, flashloanProvider = 1) {
    for (let i = 0; i < vaults.length; i += 1) {
      const { name, collateral, debt } = vaults[i];
      it(`refinance ERC20 -> ${debt.nameUp} debt with ERC20 -> ${collateral.nameUp} as collateral`, async () => {
        const depositAmount = parseUnits(DEPOSIT_ERC20, collateral.decimals);
        const borrowAmount = parseUnits(BORROW_ERC20, debt.decimals);

        await f[collateral.name].connect(users[1]).approve(f[name].address, depositAmount);
        await f[name].connect(users[1]).depositAndBorrow(depositAmount, borrowAmount);

        let preVaultDebt = await f[name].borrowBalance(f[from].address);
        preVaultDebt = formatUnitsToNum(preVaultDebt, debt.decimals);

        let preVaultCollat = await f[name].depositBalance(f[from].address);
        preVaultCollat = formatUnitsToNum(preVaultCollat, collateral.decimals);

        await f.controller
          .connect(users[0])
          .doRefinancing(f[name].address, f[to].address, flashloanProvider);

        let postVaultDebt = await f[name].borrowBalance(f[to].address);
        postVaultDebt = formatUnitsToNum(postVaultDebt, debt.decimals);

        let postVaultCollat = await f[name].depositBalance(f[to].address);
        postVaultCollat = formatUnitsToNum(postVaultCollat, collateral.decimals);

        await expect(preVaultDebt).to.be.closeTo(postVaultDebt, 1.3);
        await expect(preVaultCollat).to.be.closeTo(postVaultCollat, 1);
      });
    }
  }

  function testRefinance3(vaults, from, to, flashloanProvider = 1) {
    for (let i = 0; i < vaults.length; i += 1) {
      const { name, collateral, debt } = vaults[i];
      it(`refinance ETH debt with ERC20 -> ${collateral.nameUp} as collateral`, async () => {
        const depositAmount = parseUnits(DEPOSIT_ERC20, collateral.decimals);
        const borrowAmount = parseUnits(BORROW_ETH);

        await f[collateral.name].connect(users[1]).approve(f[name].address, depositAmount);
        await f[name].connect(users[1]).depositAndBorrow(depositAmount, borrowAmount);

        let preVaultDebt = await f[name].borrowBalance(f[from].address);
        preVaultDebt = formatUnitsToNum(preVaultDebt);

        let preVaultCollat = await f[name].depositBalance(f[from].address);
        preVaultCollat = formatUnitsToNum(preVaultCollat, collateral.decimals);

        await f.controller
          .connect(users[0])
          .doRefinancing(f[name].address, f[to].address, flashloanProvider);

        let postVaultDebt = await f[name].borrowBalance(f[to].address);
        postVaultDebt = formatUnitsToNum(postVaultDebt);

        let postVaultCollat = await f[name].depositBalance(f[to].address);
        postVaultCollat = formatUnitsToNum(postVaultCollat, collateral.decimals);

        await expect(preVaultDebt).to.be.closeTo(postVaultDebt, 0.001);
        await expect(preVaultCollat).to.be.closeTo(postVaultCollat, 1);
      });
    }
  }

  describe("Pool 3", function () {
    before(async function () {
      //evmRevert(evmSnapshot1);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await f[vault.name].setActiveProvider(f.fuse3.address);
      }
    });

    testDeposit1(fuseAddrs.fuse3Comptroller, [vaultethdai, vaultethusdc]);
    testDeposit2(fuseAddrs.fuse3Comptroller, [vaultdaiusdc, vaultusdcdai]);

    testBorrow1([vaultethdai, vaultethusdc]);
    testBorrow2([vaultdaiusdc, vaultusdcdai]);
    testBorrow3([vaultdaieth]);

    testPaybackAndWithdraw1([vaultethdai, vaultethusdc]);
    testPaybackAndWithdraw2([vaultdaiusdc, vaultusdcdai]);
    testPaybackAndWithdraw3([vaultdaieth]);

    testRefinance1([vaultethusdc, vaultethdai], "fuse3", "fuse18", 1);
    testRefinance2([vaultusdcdai], "fuse3", "fuse18", 1);
    testRefinance3([vaultdaieth], "fuse3", "fuse18", 1);
  });

  describe("Pool 6", function () {
    before(async function () {
      // REVERT to 2
      evmRevert(evmSnapshot2);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await f[vault.name].setActiveProvider(f.fuse6.address);
      }
    });

    testDeposit1(fuseAddrs.fuse6Comptroller, [vaultethdai, vaultethusdc, vaultethfei]);
    testDeposit2(fuseAddrs.fuse6Comptroller, [
      vaultdaiusdc,
      vaultusdcdai,
      vaultdaiusdt,
      vaultdaieth,
    ]);

    testBorrow1([vaultethdai, vaultethusdc, vaultethfei]);
    testBorrow2([vaultdaiusdc, vaultusdcdai]);
    // borrowing ETH is paused on this pool
    //testBorrow3([vaultdaieth, vaultfeieth]);

    testPaybackAndWithdraw1([vaultethdai, vaultethusdc, vaultethfei]);
    testPaybackAndWithdraw2([vaultdaiusdc, vaultusdcdai]);
    // borrowing ETH is paused on this pool
    //testPaybackAndWithdraw3([vaultdaieth, vaultfeieth]);

    testRefinance1([vaultethfei, vaultethusdc], "fuse6", "fuse18", 2);
    testRefinance2([vaultusdcdai], "fuse6", "fuse18", 1);
    // borrowing ETH is paused on this pool
    //testRefinance3([vaultdaieth], "fuse6", "fuse18", 1);
  });

  describe("Pool 7", function () {
    before(async function () {
      // REVERT to 2
      evmRevert(evmSnapshot2);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await f[vault.name].setActiveProvider(f.fuse7.address);
      }
    });

    testDeposit1(fuseAddrs.fuse7Comptroller, [vaultethusdc, vaultethfei]);
    testDeposit2(fuseAddrs.fuse7Comptroller, [vaultfeiusdc, vaultusdcfei]);

    testBorrow1([vaultethusdc, vaultethfei]);
    testBorrow2([vaultfeiusdc, vaultusdcfei]);
    // borrowing ETH is paused on this pool
    //testBorrow3([vaultdaieth, vaultfeieth]);

    testPaybackAndWithdraw1([vaultethusdc, vaultethfei]);
    testPaybackAndWithdraw2([vaultfeiusdc, vaultusdcfei]);
    // borrowing ETH is paused on this pool
    //testPaybackAndWithdraw3([vaultdaieth, vaultfeieth]);

    testRefinance1([vaultethfei, vaultethusdc], "fuse7", "fuse18", 2);
    testRefinance2([vaultusdcfei], "fuse7", "fuse18", 2);
    // borrowing ETH is paused on this pool
    //testRefinance3([vaultfeieth], "fuse7", "fuse18", 1);
  });

  describe("Pool 8", function () {
    before(async function () {
      // REVERT to 2
      evmRevert(evmSnapshot2);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await f[vault.name].setActiveProvider(f.fuse8.address);
      }
    });

    testDeposit1(fuseAddrs.fuse8Comptroller, [vaultethdai, vaultethfei]);
    testDeposit2(fuseAddrs.fuse8Comptroller, [vaultfeidai, vaultdaifei]);

    testBorrow1([vaultethdai, vaultethfei]);
    testBorrow2([vaultfeidai, vaultdaifei]);
    testBorrow3([vaultdaieth, vaultfeieth]);

    testPaybackAndWithdraw1([vaultethdai, vaultethfei]);
    testPaybackAndWithdraw2([vaultfeidai, vaultdaifei]);
    testPaybackAndWithdraw3([vaultdaieth, vaultfeieth]);

    testRefinance1([vaultethfei, vaultethdai], "fuse8", "fuse18", 2);
    testRefinance2([vaultdaifei, vaultfeidai], "fuse8", "fuse18", 2);
    testRefinance3([vaultdaieth, vaultfeieth], "fuse8", "fuse18", 1);
  });

  describe("Pool 18", function () {
    before(async function () {
      // REVERT to 2
      evmRevert(evmSnapshot2);

      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await f[vault.name].setActiveProvider(f.fuse18.address);
      }
    });

    testDeposit1(fuseAddrs.fuse18Comptroller, [vaultethdai, vaultethusdc, vaultethfei]);
    testDeposit2(fuseAddrs.fuse18Comptroller, [
      vaultdaiusdc,
      vaultusdcdai,
      vaultdaiusdt,
      vaultdaieth,
    ]);

    testBorrow1([vaultethdai, vaultethusdc, vaultethfei]);
    testBorrow2([vaultdaiusdc, vaultusdcdai]);
    testBorrow3([vaultdaieth, vaultfeieth]);

    testPaybackAndWithdraw1([vaultethdai, vaultethusdc, vaultethfei]);
    testPaybackAndWithdraw2([vaultdaiusdc, vaultusdcdai]);
    testPaybackAndWithdraw3([vaultdaieth, vaultfeieth]);

    testRefinance1([vaultethfei, vaultethusdc], "fuse18", "fuse6", 2);
    testRefinance2([vaultusdcdai], "fuse18", "fuse3", 1);
    testRefinance3([vaultdaieth, vaultfeieth], "fuse18", "fuse8", 2);
  });
});
