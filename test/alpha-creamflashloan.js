const { ethers, waffle, upgrades } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { deployContract } = waffle;

const CHAINLINK_ORACLE_ADDR = "0x773616E4d11A78F511299002da57A0a94577F1f4";
const UNISWAP_ROUTER_ADDR = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const TREASURY_ADDR = "0x9F5A10E45906Ef12497237cE10fB7AB9B850Ff86";

const Fliquidator = require("../artifacts/contracts/Fliquidator.sol/Fliquidator.json");
const VaultHarvester = require("../artifacts/contracts/Harvester.sol/VaultHarvester.json");
const Swapper = require("../artifacts/contracts/Swapper.sol/Swapper.json");
const Aave = require("../artifacts/contracts/providers/ProviderAave.sol/ProviderAave.json");
const Compound = require("../artifacts/contracts/providers/ProviderCompound.sol/ProviderCompound.json");
const Dydx = require("../artifacts/contracts/providers/ProviderDYDX.sol/ProviderDYDX.json");
const Flasher = require("../artifacts/contracts/flashloans/Flasher.sol/Flasher.json");
const Controller = require("../artifacts/contracts/Controller.sol/Controller.json");
const FujiOracle = require("../artifacts/contracts/FujiOracle.sol/FujiOracle.json");

const FujiMapping = require("../artifacts/contracts/FujiMapping.sol/FujiMapping.json");
const { ASSETS } = require("./utils-alpha");

const fixture = async ([wallet]) => {
  // Step 1 of Deploy: Contracts which address is required to be hardcoded in other contracts
  const creamfujimapping = await deployContract(wallet, FujiMapping, []);

  // Step 1 (Only for testing of CreamFinance FlashLoans)
  // Setting up the CreamFinance FujiMapper
  await creamfujimapping.setMapping(
    "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "0xD06527D5e56A3495252A528C4987003b712860eE"
  );
  await creamfujimapping.setMapping(
    "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "0x92B767185fB3B04F881e3aC8e5B0662a027A1D9f"
  );
  await creamfujimapping.setMapping(
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "0x44fbeBd2F576670a6C33f6Fc0B00aA8c5753b322"
  );
  await creamfujimapping.setMapping(
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0x797AAB1ce7c01eB727ab980762bA88e7133d2157"
  );

  // Step 2 Of Deploy: Functional Contracts
  const FujiAdmin = await ethers.getContractFactory("FujiAdmin");
  const fujiadmin = await upgrades.deployProxy(FujiAdmin, []);
  const fliquidator = await deployContract(wallet, Fliquidator, []);
  const flasher = await deployContract(wallet, Flasher, []);
  const controller = await deployContract(wallet, Controller, []);
  const FujiERC1155 = await ethers.getContractFactory("FujiERC1155");
  const f1155 = await upgrades.deployProxy(FujiERC1155, []);
  const oracle = await deployContract(wallet, FujiOracle, [
    Object.values(ASSETS).map((asset) => asset.address),
    Object.values(ASSETS).map((asset) => asset.oracle),
  ]);
  // Step 3 Of Deploy: Provider Contracts
  const aave = await deployContract(wallet, Aave, []);
  const compound = await deployContract(wallet, Compound, []);
  const dydx = await deployContract(wallet, Dydx, []);

  // Step 4 Of Deploy Core Money Handling Contracts
  const vaultharvester = await deployContract(wallet, VaultHarvester, []);
  const swapper = await deployContract(wallet, Swapper, []);
  const FujiVault = await ethers.getContractFactory("FujiVault");
  const vaultdai = await upgrades.deployProxy(FujiVault, [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.DAI.address,
  ]);
  const vaultusdc = await upgrades.deployProxy(FujiVault, [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.USDC.address,
  ]);
  const vaultusdt = await upgrades.deployProxy(FujiVault, [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.USDT.address,
  ]);

  // Step 5 - General Plug-ins and Set-up Transactions
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury(TREASURY_ADDR);
  await fujiadmin.setController(controller.address);
  await fujiadmin.setVaultHarvester(vaultharvester.address);
  await fujiadmin.setSwapper(swapper.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setFujiOracle(oracle.address);
  await fliquidator.setSwapper(UNISWAP_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(fliquidator.address, true);
  await f1155.setPermit(vaultdai.address, true);
  await f1155.setPermit(vaultusdc.address, true);
  await f1155.setPermit(vaultusdt.address, true);

  // Step 6 - Vault Set-up
  await vaultdai.setProviders([compound.address, aave.address, dydx.address]);
  await vaultdai.setActiveProvider(compound.address);
  await vaultdai.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultdai.address, true);

  await vaultusdc.setProviders([compound.address, aave.address, dydx.address]);
  await vaultusdc.setActiveProvider(compound.address);
  await vaultusdc.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultusdc.address, true);

  await vaultusdt.setProviders([compound.address, aave.address]);
  await vaultusdt.setActiveProvider(compound.address);
  await vaultusdt.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultusdt.address, true);

  return {
    fujiadmin,
    fliquidator,
    flasher,
    controller,
    f1155,
    aave,
    compound,
    dydx,
    vaultharvester,
    swapper,
    vaultdai,
    vaultusdc,
    vaultusdt,
  };
};

/*
const timeTravel = async (seconds) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
};

const advanceblocks = async (blocks) => {
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine");
  }
};

const convertToCurrencyDecimals = async (tokenAddr, amount) => {
  const token = await ethers.getContractAt("IERC20Detailed", tokenAddr);
  let decimals = (await token.decimals()).toString();

  return ethers.utils.parseUnits(`${amount}`, decimals);
};

const convertToWei = (amount) => ethers.utils.parseUnits(`${amount}`, 18);
*/

const evmSnapshot = async () => ethers.provider.send("evm_snapshot", []);
const evmRevert = async (id) => ethers.provider.send("evm_revert", [id]);

// use(solidity);

describe("Alpha", () => {
  let fliquidator;
  let f1155;
  let compound;
  let vaultdai;
  let vaultusdc;
  let vaultusdt;

  let users;

  let loadFixture;
  let evmSnapshotId;

  before(async () => {
    users = await ethers.getSigners();
    loadFixture = createFixtureLoader(users, ethers.provider);
    evmSnapshotId = await evmSnapshot();
  });

  after(async () => {
    evmRevert(evmSnapshotId);
  });

  beforeEach(async () => {
    const theFixture = await loadFixture(fixture);

    fliquidator = theFixture.fliquidator;
    f1155 = theFixture.f1155;
    compound = theFixture.compound;
    vaultdai = theFixture.vaultdai;
    vaultusdc = theFixture.vaultusdc;
    vaultusdt = theFixture.vaultusdt;
  });

  describe("Alpha Fliquidator-with CreamFlashLoans Functionality", () => {
    it("1.- Full Flashclose User, using CreamFlashLoans, vaultdai", async () => {
      // vault to use
      const thevault = vaultdai;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(compound.address);

      // Set - up
      const randomUser = users[6];
      const borrowAmount = ethers.utils.parseUnits("3000", 18);
      const depositAmount = ethers.utils.parseEther("5", 18);
      const vAssetStruct = await thevault.vAssets();

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await thevault
        .connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      await fliquidator.connect(randomUser).flashClose(-1, thevault.address, 2);

      const randomUser1155balCollat = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat", randomUser1155balCollat/1, "1155tokenbaldebt", randomUser1155balDebt/1);

      await expect(randomUser1155balCollat).to.equal(0);
      await expect(randomUser1155balDebt).to.equal(0);
    });

    it("2.- Full Flashclose User, using CreamFlashLoans, vaultusdc", async () => {
      // vault to use
      const thevault = vaultusdc;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(compound.address);

      // Set - up
      const randomUser = users[7];
      const borrowAmount = ethers.utils.parseUnits("3000", 6);
      const depositAmount = ethers.utils.parseEther("5", 18);
      const vAssetStruct = await thevault.vAssets();

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await thevault
        .connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      await fliquidator.connect(randomUser).flashClose(-1, thevault.address, 2);

      const randomUser1155balCollat = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat", randomUser1155balCollat/1, "1155tokenbaldebt", randomUser1155balDebt/1);

      await expect(randomUser1155balCollat).to.equal(0);
      await expect(randomUser1155balDebt).to.equal(0);
    });

    it("3.- Partial Flashclose User,using CreamFlashLoans, vaultusdt", async () => {
      // vault to use
      const thevault = vaultusdt;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(compound.address);

      // Set - up
      const randomUser = users[8];
      const depositAmount = ethers.utils.parseEther("10", 18);
      const borrowAmount = ethers.utils.parseUnits("7500", 6);
      const partialRepayAmount = ethers.utils.parseUnits("5000", 6);
      const vAssetStruct = await thevault.vAssets();

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await thevault
        .connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      const randomUser1155balCollat0 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt0 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat0", randomUser1155balCollat0/1, "1155tokenbaldebt0", randomUser1155balDebt0/1);

      await fliquidator.connect(randomUser).flashClose(partialRepayAmount, thevault.address, 2);

      const randomUser1155balCollat1 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt1 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat1", randomUser1155balCollat1/1, "1155tokenbaldebt1", randomUser1155balDebt1/1);

      await expect(randomUser1155balCollat1).to.be.lt(randomUser1155balCollat0);
      await expect(randomUser1155balDebt1).to.be.lt(randomUser1155balDebt0);
    });

    it("4.- Partial Flashclose User,using CreamFlashLoans, vaultusdc", async () => {
      // vault to use
      const thevault = vaultusdc;

      // Set a defined ActiveProviders
      await thevault.setActiveProvider(compound.address);

      // Set - up
      const randomUser = users[10];
      const depositAmount = ethers.utils.parseEther("10", 18);
      const borrowAmount = ethers.utils.parseUnits("7500", 6);
      const partialRepayAmount = ethers.utils.parseUnits("5000", 6);
      const vAssetStruct = await thevault.vAssets();

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await thevault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Set - up randomUser
      await thevault
        .connect(randomUser)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
      const randomUser1155balCollat0 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt0 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat0", randomUser1155balCollat0/1, "1155tokenbaldebt0", randomUser1155balDebt0/1);

      await fliquidator.connect(randomUser).flashClose(partialRepayAmount, thevault.address, 2);

      const randomUser1155balCollat1 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.collateralID
      );
      const randomUser1155balDebt1 = await f1155.balanceOf(
        randomUser.address,
        vAssetStruct.borrowID
      );
      // console.log("1155tokenbalcollat1", randomUser1155balCollat1/1, "1155tokenbaldebt1", randomUser1155balDebt1/1);

      await expect(randomUser1155balCollat1).to.be.lt(randomUser1155balCollat0);
      await expect(randomUser1155balDebt1).to.be.lt(randomUser1155balDebt0);
    });
  });
});
