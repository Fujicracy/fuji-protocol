const { ethers, waffle } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");
const { deployContract } = waffle;
const { getContractAt } = ethers;

const {
  fixture,
  convertToWei,
  convertToCurrencyDecimals,
  evmSnapshot,
  evmRevert,
  ASSETS,
  ZERO_ADDR,
  UNISWAP_ROUTER_ADDR,
} = require("./utils-alpha");

const Fuse3 = require("../artifacts/contracts/Providers/ProviderFuse3.sol/ProviderFuse3.json");
const Fuse18 = require("../artifacts/contracts/Providers/ProviderFuse18.sol/ProviderFuse18.json");
const fuseAddrs = {
  fuse3Comptroller: "0x6E7fb6c5865e8533D5ED31b6d43fD95f4C411834",
  fuse18Comptroller: "0x621579DD26774022F33147D3852ef4E00024b763",
};

describe("Rari Fuse", () => {
  let f;
  let fuse3;
  let fuse18;

  let users;
  let user1;

  let evmSnapshot0;
  let evmSnapshot1;
  let evmSnapshot2;

  before(async () => {
    users = await ethers.getSigners();
    user1 = users[1];

    const loadFixture = createFixtureLoader(users, ethers.provider);
    f = await loadFixture(fixture);
    evmSnapshot0 = await evmSnapshot();

    fuse3 = await deployContract(users[0], Fuse3, []);
    fuse18 = await deployContract(users[0], Fuse18, []);

    const swapper = await getContractAt("IUniswapV2Router02", UNISWAP_ROUTER_ADDR);
    const block = await ethers.provider.getBlock();

    for (let x = 0; x < 4; x += 1) {
      await swapper.connect(users[x]).swapETHForExactTokens(
        convertToWei(10000),
        [ASSETS.WETH.address, ASSETS.DAI.address],
        users[x].address,
        block.timestamp + x + 1,
        { value: convertToWei(10) }
      );
    }

    evmSnapshot1 = await evmSnapshot();
  });

  after(async () => {
    evmRevert(evmSnapshot0);
  });

  async function testDeposit(ctrlAddr) {
    describe("deposit()", () => {
      it("deposit ETH as collateral, check vault's balanace", async() => {
        const fuseComptroller = await getContractAt("IFuseComptroller", ctrlAddr);
        const cTokenAddr = await fuseComptroller.cTokensByUnderlying(ZERO_ADDR);
        const cETH = await getContractAt("ICEth", cTokenAddr);

        const vaults = [f.vaultdai, f.vaultusdc];
        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(1);
          const negdepositAmount = convertToWei(-1);

          await expect(
            await vaults[i].connect(user1).deposit(depositAmount, { value: depositAmount })
          ).to.changeEtherBalance(user1, negdepositAmount);

          const vaultBal = await cETH.balanceOf(vaults[i].address);
          const rate = await cETH.exchangeRateStored();
          const tokenAmount = (depositAmount * 1e18) / rate;
          await expect(vaultBal / 1).to.be.closeTo(tokenAmount / 1, 200);
        }
      });

      it("deposit DAI as collateral, check vault's balanace", async() => {
        const fuseComptroller = await getContractAt("IFuseComptroller", ctrlAddr);
        const cTokenAddr = await fuseComptroller.cTokensByUnderlying(ASSETS.DAI.address);
        const cDAI = await getContractAt("ICErc20", cTokenAddr);

        const vaults = [f.vaultdaieth, f.vaultdaiusdc];
        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(1);
          const negdepositAmount = convertToWei(-1);

          await f.dai.connect(user1).approve(vaults[i].address, depositAmount);
          await expect(
            () => vaults[i].connect(user1).deposit(depositAmount)
          ).to.changeTokenBalance(f.dai, user1, negdepositAmount);

          const vaultBal = await cDAI.balanceOf(vaults[i].address);
          const rate = await cDAI.exchangeRateStored();
          const tokenAmount = (depositAmount * 1e18) / rate;
          await expect(vaultBal / 1).to.be.closeTo(tokenAmount / 1, 200);
        }
      });
    });
  }

  async function testBorrow() {
    describe("borrow()", () => {
      it("borrow ERC20 after depositing ETH as collateral", async() => {
        const vaults = [f.vaultdai, f.vaultusdc];
        const tokens = [f.dai, f.usdc];
        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(2);
          const negdepositAmount = convertToWei(-2);
          const borrowAmount = await convertToCurrencyDecimals(tokens[i].address, 3000);

          await expect(
            await vaults[i].connect(user1).deposit(depositAmount, { value: depositAmount })
          ).to.changeEtherBalance(user1, negdepositAmount);
          await expect(
            () => vaults[i].connect(user1).borrow(borrowAmount)
          ).to.changeTokenBalance(tokens[i], user1, borrowAmount);
        }
      });

      it("borrow ERC20 after depositing DAI as collateral", async() => {
        const depositAmount = convertToWei(5000);
        const negdepositAmount = convertToWei(-5000);
        const borrowAmount = await convertToCurrencyDecimals(f.usdc.address, 3000);

        await f.dai.connect(user1).approve(f.vaultdaiusdc.address, depositAmount);
        await expect(
          () => f.vaultdaiusdc.connect(user1).deposit(depositAmount)
        ).to.changeTokenBalance(f.dai, user1, negdepositAmount);
        await expect(
          () => f.vaultdaiusdc.connect(user1).borrow(borrowAmount)
        ).to.changeTokenBalance(f.usdc, user1, borrowAmount);
      });

      it("borrow ETH after depositing DAI as collateral", async() => {
        const depositAmount = convertToWei(5000);
        const negdepositAmount = convertToWei(-5000);
        const borrowAmount = convertToWei(1);

        await f.dai.connect(user1).approve(f.vaultdaieth.address, depositAmount);
        await expect(
          () => f.vaultdaieth.connect(user1).deposit(depositAmount)
        ).to.changeTokenBalance(f.dai, user1, negdepositAmount);
        await expect(
          await f.vaultdaieth.connect(user1).borrow(borrowAmount)
        ).to.changeEtherBalance(user1, borrowAmount);
      });
    });
  }

  async function testPaybackAndWithdraw() {
    describe("payback() and withdraw()", () => {
      before(async () => {
        evmRevert(evmSnapshot2);
      });

      it("payback ERC20 and withdraw ETH", async() => {
        const vaults = [f.vaultdai, f.vaultusdc];
        const tokens = [f.dai, f.usdc];

        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(2);
          const borrowAmount = await convertToCurrencyDecimals(tokens[i].address, 3000);
          const one = await convertToCurrencyDecimals(tokens[i].address, 1);
          const negborrowAmount = await convertToCurrencyDecimals(tokens[i].address, -3000);
          const { collateralID, borrowID } = await vaults[i].vAssets();
          // boostrap vault
          await vaults[i].connect(users[0]).deposit(depositAmount, { value: depositAmount });

          for (let x = 1; x < 4; x += 1) {
            await vaults[i].connect(users[x]).depositAndBorrow(
              depositAmount,
              borrowAmount,
              { value: depositAmount }
            );
          }

          for (let x = 1; x < 4; x += 1) {
            await tokens[i].connect(users[x]).approve(vaults[i].address, borrowAmount);
            await expect(
              () => vaults[i].connect(users[x]).payback(borrowAmount)
            ).to.changeTokenBalance(tokens[i], users[x], negborrowAmount);
            await expect(await f.f1155.balanceOf(users[x].address, borrowID)).to.be.lt(one);
          }

          for (let x = 1; x < 4; x += 1) {
            await vaults[i].connect(users[x]).withdraw(-1);
            await expect(await f.f1155.balanceOf(users[x].address, collateralID)).to.be.lt(1e13);
          }
        }
      });

      it("payback ERC20 and withdraw DAI", async() => {
        const depositAmount = convertToWei(5000);
        const borrowAmount = await convertToCurrencyDecimals(f.usdc.address, 3000);
        const negborrowAmount = await convertToCurrencyDecimals(f.usdc.address, -3000);
        const { collateralID, borrowID } = await f.vaultdaiusdc.vAssets();
        // boostrap vault
        await f.dai.connect(users[0]).approve(f.vaultdaiusdc.address, depositAmount);
        await f.vaultdaiusdc.connect(users[0]).deposit(depositAmount);

        for (let x = 1; x < 4; x += 1) {
          await f.dai.connect(users[x]).approve(f.vaultdaiusdc.address, depositAmount);
          await f.vaultdaiusdc.connect(users[x]).depositAndBorrow(
            depositAmount,
            borrowAmount
          );
        }

        for (let x = 1; x < 4; x += 1) {
          await f.usdc.connect(users[x]).approve(f.vaultdaiusdc.address, borrowAmount);
          await expect(
            () => f.vaultdaiusdc.connect(users[x]).payback(borrowAmount)
          ).to.changeTokenBalance(f.usdc, users[x], negborrowAmount);
          await expect(await f.f1155.balanceOf(users[x].address, borrowID)).to.be.lt(2e4);
        }

        const one = await convertToCurrencyDecimals(f.dai.address, 1);
        for (let x = 1; x < 4; x += 1) {
          await f.vaultdaiusdc.connect(users[x]).withdraw(-1);
          await expect(await f.f1155.balanceOf(users[x].address, collateralID)).to.be.lt(one);
        }
      });

      it("payback ETH and withdraw DAI", async() => {
        const depositAmount = await convertToCurrencyDecimals(f.dai.address, 5000);
        const borrowAmount = await convertToWei(1);
        const negborrowAmount = await convertToWei(-1);
        const { collateralID, borrowID } = await f.vaultdaieth.vAssets();
        // boostrap vault
        await f.dai.connect(users[0]).approve(f.vaultdaieth.address, depositAmount);
        await f.vaultdaieth.connect(users[0]).deposit(depositAmount);

        for (let x = 1; x < 4; x += 1) {
          await f.dai.connect(users[x]).approve(f.vaultdaieth.address, depositAmount);
          await f.vaultdaieth.connect(users[x]).depositAndBorrow(
            depositAmount,
            borrowAmount
          );
        }

        for (let x = 1; x < 4; x += 1) {
          await expect(
            await f.vaultdaieth.connect(users[x]).payback(borrowAmount, { value: borrowAmount })
          ).to.changeEtherBalance(users[x], negborrowAmount);
          await expect(await f.f1155.balanceOf(users[x].address, borrowID)).to.be.lt(1e13);
        }

        for (let x = 1; x < 4; x += 1) {
          await f.vaultdaieth.connect(users[x]).withdraw(-1);
          await expect(await f.f1155.balanceOf(users[x].address, collateralID)).to.be.lt(1e15);
        }
      });
    });
  }

  describe("Pool 3", () => {
    before(async () => {
      const vaultsETH = [f.vaultdai, f.vaultusdc];
      for (let i = 0; i < vaultsETH.length; i += 1) {
        await vaultsETH[i].setProviders([fuse3.address]);
        await vaultsETH[i].setActiveProvider(fuse3.address);
      }

      const vaultsDAI = [f.vaultdaieth, f.vaultdaiusdc];
      for (let i = 0; i < vaultsDAI.length; i += 1) {
        await vaultsDAI[i].setProviders([fuse3.address]);
        await vaultsDAI[i].setActiveProvider(fuse3.address);
      }

      evmSnapshot2 = await evmSnapshot();
    });

    testDeposit(fuseAddrs.fuse3Comptroller);

    testBorrow();

    testPaybackAndWithdraw();
  });

  describe("Pool 18", () => {
    before(async () => {
      evmRevert(evmSnapshot1);

      const vaultsETH = [f.vaultdai, f.vaultusdc];
      for (let i = 0; i < vaultsETH.length; i += 1) {
        await vaultsETH[i].setProviders([fuse18.address]);
        await vaultsETH[i].setActiveProvider(fuse18.address);
      }

      const vaultsDAI = [f.vaultdaieth, f.vaultdaiusdc];
      for (let i = 0; i < vaultsDAI.length; i += 1) {
        await vaultsDAI[i].setProviders([fuse18.address]);
        await vaultsDAI[i].setActiveProvider(fuse18.address);
      }

      evmSnapshot2 = await evmSnapshot();
    });

    testDeposit(fuseAddrs.fuse18Comptroller);

    testBorrow();

    testPaybackAndWithdraw();
  });

  describe("Switch from Pool 18 to Pool 3", () => {
    before(async () => {
      evmRevert(evmSnapshot1);

      const vaultsETH = [f.vaultdai, f.vaultusdc];
      for (let i = 0; i < vaultsETH.length; i += 1) {
        await vaultsETH[i].setProviders([fuse3.address, fuse18.address]);
        await vaultsETH[i].setActiveProvider(fuse18.address);
      }

      const vaultsDAI = [f.vaultdaieth, f.vaultdaiusdc];
      for (let i = 0; i < vaultsDAI.length; i += 1) {
        await vaultsDAI[i].setProviders([fuse3.address, fuse18.address]);
        await vaultsDAI[i].setActiveProvider(fuse18.address);
      }
    });

    describe("doRefinancing()", () => {
      it("refinance ERC20 debt", async() => {
        const tokens = [f.dai, f.usdc];
        const vaults = [f.vaultdai, f.vaultusdc];
        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(2);
          const borrowAmount = await convertToCurrencyDecimals(tokens[i].address, 3000);

          await vaults[i].connect(users[1]).depositAndBorrow(
            depositAmount,
            borrowAmount,
            { value: depositAmount }
          );

          const preVaultDebt = await vaults[i].borrowBalance(fuse18.address);
          const preVaultCollat = await vaults[i].depositBalance(fuse18.address);

          await f.controller.connect(users[0])
            .doRefinancing(vaults[i].address, fuse3.address, 1, 1, 1);

          const postVaultDebt = await vaults[i].borrowBalance(fuse3.address);
          const postVaultCollat = await vaults[i].depositBalance(fuse3.address);

          await expect(preVaultDebt / 1).to.be.closeTo(postVaultDebt / 1, 1e15);
          await expect(preVaultCollat / 1).to.be.closeTo(postVaultCollat / 1, 1e15);
        }

      });

      it("refinance ETH debt", async() => {
        const depositAmount = await convertToCurrencyDecimals(f.dai.address, 5000);
        const borrowAmount = await convertToWei(1);

        await f.dai.connect(users[1]).approve(f.vaultdaieth.address, depositAmount);
        await f.vaultdaieth.connect(users[1]).depositAndBorrow(
          depositAmount,
          borrowAmount
        );

        const preVaultDebt = await f.vaultdaieth.borrowBalance(fuse18.address);
        const preVaultCollat = await f.vaultdaieth.depositBalance(fuse18.address);

        await f.controller.connect(users[0])
          .doRefinancing(f.vaultdaieth.address, fuse3.address, 1, 1, 1);

        const postVaultDebt = await f.vaultdaieth.borrowBalance(fuse3.address);
        const postVaultCollat = await f.vaultdaieth.depositBalance(fuse3.address);

        await expect(preVaultDebt / 1).to.be.closeTo(postVaultDebt / 1, 1e15);
        await expect(preVaultCollat / 1).to.be.closeTo(postVaultCollat / 1, 1e15);
      });
    });

  });

});
