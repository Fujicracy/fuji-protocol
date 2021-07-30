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

describe("Rari Fuse", () => {
  let f;
  let fuse3;
  let fuse18;

  let users;
  let user1;

  let loadFixture;
  let evmSnapshotInit;
  let evmSnapshotOn;

  before(async () => {
    users = await ethers.getSigners();
    user1 = users[1];

    loadFixture = createFixtureLoader(users, ethers.provider);
    f = await loadFixture(fixture);
    evmSnapshotInit = await evmSnapshot();

    fuse3 = await deployContract(users[0], Fuse3, []);
    fuse18 = await deployContract(users[0], Fuse18, []);

    fuse3Comptroller = await getContractAt("IFuseComptroller", "0x6E7fb6c5865e8533D5ED31b6d43fD95f4C411834");
    fuse18Comptroller = await getContractAt("IFuseComptroller", "0x621579DD26774022F33147D3852ef4E00024b763");

    const swapper = await getContractAt("IUniswapV2Router02", UNISWAP_ROUTER_ADDR);
    const block = await ethers.provider.getBlock();

    for (let x = 1; x < 4; x += 1) {
      await swapper.connect(users[x]).swapETHForExactTokens(
        convertToWei(10000),
        [ASSETS.WETH.address, ASSETS.DAI.address],
        users[x].address,
        block.timestamp + x,
        { value: convertToWei(10) }
      );
    }

    evmSnapshotOn = await evmSnapshot();
  });

  after(async () => {
    evmRevert(evmSnapshotInit);
  });

  //beforeEach(async () => {
  //});

  async function checkBalanceOf(vault, token, depositAmount, diff = 200) {
    const vaultBal = await token.balanceOf(vault.address);
    const rate = await token.exchangeRateStored();
    const tokenAmount = (depositAmount * 1e18) / rate;
    await expect(vaultBal / 1).to.be.closeTo(tokenAmount / 1, diff);
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
    });

    describe("deposit()", () => {
      it("deposit ETH as collateral, check vault's balanace", async() => {
        const vaults = [f.vaultdai, f.vaultusdc];
        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(1);
          const negdepositAmount = convertToWei(-1);

          await expect(
            await vaults[i].connect(user1).deposit(depositAmount, { value: depositAmount })
          ).to.changeEtherBalance(user1, negdepositAmount);

          const cTokenAddr = await fuse3Comptroller.cTokensByUnderlying(ZERO_ADDR);
          const cETH = await getContractAt("ICEth", cTokenAddr);
          checkBalanceOf(vaults[i], cETH, depositAmount);
        }
      });

      it("deposit DAI as collateral, check vault's balanace", async() => {
        const vaults = [f.vaultdaieth, f.vaultdaiusdc];
        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(1);
          const negdepositAmount = convertToWei(-1);

          await f.dai.connect(user1).approve(vaults[i].address, depositAmount);
          await expect(
            () => vaults[i].connect(user1).deposit(depositAmount)
          ).to.changeTokenBalance(f.dai, user1, negdepositAmount);

          const cTokenAddr = await fuse3Comptroller.cTokensByUnderlying(ASSETS.DAI.address);
          const cDAI = await getContractAt("ICErc20", cTokenAddr);
          checkBalanceOf(vaults[i], cDAI, depositAmount);
        }
      });
    });

    describe("borrow()", () => {
      it("borrow ERC20 after depositing ETH as collateral", async() => {
        const vaults = [f.vaultdai, f.vaultusdc];
        const tokens = [f.dai, f.usdc];
        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(2);
          const negdepositAmount = convertToWei(-2);
          const borrowAmount = await convertToCurrencyDecimals(tokens[i].address, 2000);

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
        const borrowAmount = await convertToCurrencyDecimals(f.usdc.address, 2000);

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
  });

  describe("Pool 18", () => {
    before(async () => {
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
    });

    describe("deposit()", () => {
      it("deposit ETH as collateral, check vault's balanace", async() => {
        const vaults = [f.vaultdai, f.vaultusdc];
        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(1);
          const negdepositAmount = convertToWei(-1);

          await expect(
            await vaults[i].connect(user1).deposit(depositAmount, { value: depositAmount })
          ).to.changeEtherBalance(user1, negdepositAmount);

          const cTokenAddr = await fuse18Comptroller.cTokensByUnderlying(ZERO_ADDR);
          const cETH = await getContractAt("ICEth", cTokenAddr);
          checkBalanceOf(vaults[i], cETH, depositAmount, 100000000000);
        }
      });

      it("deposit DAI as collateral, check vault's balanace", async() => {
        const vaults = [f.vaultdaieth, f.vaultdaiusdc];
        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(1);
          const negdepositAmount = convertToWei(-1);

          await f.dai.connect(user1).approve(vaults[i].address, depositAmount);
          await expect(
            () => vaults[i].connect(user1).deposit(depositAmount)
          ).to.changeTokenBalance(f.dai, user1, negdepositAmount);

          const cTokenAddr = await fuse18Comptroller.cTokensByUnderlying(ASSETS.DAI.address);
          const cDAI = await getContractAt("ICErc20", cTokenAddr);
          checkBalanceOf(vaults[i], cDAI, depositAmount);
        }
      });
    });

    describe("borrow()", () => {
      it("borrow ERC20 after depositing ETH as collateral", async() => {
        const tokens = [f.dai, f.usdc];
        const vaults = [f.vaultdai, f.vaultusdc];
        for (let i = 0; i < vaults.length; i += 1) {
          const depositAmount = convertToWei(2);
          const negdepositAmount = convertToWei(-2);
          const borrowAmount = await convertToCurrencyDecimals(tokens[i].address, 2000);

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
        const borrowAmount = await convertToCurrencyDecimals(f.usdc.address, 2000);

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
  });

  describe("Switch from Pool 18 to Pool 3", () => {
    before(async () => {
      evmRevert(evmSnapshotOn);

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
          const borrowAmount = await convertToCurrencyDecimals(tokens[i].address, 2000);

          for (let x = 1; x < 4; x += 1) {
            await vaults[i].connect(users[x]).depositAndBorrow(
              depositAmount,
              borrowAmount,
              { value: depositAmount }
            );
          }

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

        for (let x = 1; x < 4; x += 1) {
          await f.dai.connect(users[x]).approve(f.vaultdaieth.address, depositAmount);
          await f.vaultdaieth.connect(users[x]).depositAndBorrow(
            depositAmount,
            borrowAmount
          );
        }

        //const preVaultDebt = await f.vaultdaieth.borrowBalance(fuse18.address);
        //const preVaultCollat = await f.vaultdaieth.depositBalance(fuse18.address);

        //await f.controller.connect(users[0])
          //.doRefinancing(f.vaultdaieth.address, fuse3.address, 1, 1, 1);

        //const postVaultDebt = await f.vaultdaieth.borrowBalance(fuse3.address);
        //const postVaultCollat = await f.vaultdaieth.depositBalance(fuse3.address);

        //await expect(preVaultDebt / 1).to.be.closeTo(postVaultDebt / 1, 1e15);
        //await expect(preVaultCollat / 1).to.be.closeTo(postVaultCollat / 1, 1e15);
      });
    });

  });

});
