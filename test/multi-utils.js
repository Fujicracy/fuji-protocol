const { ethers, waffle, upgrades } = require("hardhat");

const { deployContract } = waffle;

const UNISWAP_ROUTER_ADDR = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const TREASURY_ADDR = "0x9F5A10E45906Ef12497237cE10fB7AB9B850Ff86";

// Define the Asset Objects to be tested
const ASSETS = {
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    oracle: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
  },
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    oracle: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    oracle: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
  },
  ETH: {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    decimals: 18,
    oracle: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  },
  WBTC: {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    oracle: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  }
};

// Define funder wallet amount

const FujiAdmin = require("../artifacts/contracts/FujiAdmin.sol/FujiAdmin.json");
const Fliquidator = require("../artifacts/contracts/Fliquidator.sol/Fliquidator.json");
const VaultHarvester = require("../artifacts/contracts/Vaults/VaultHarvester.sol/VaultHarvester.json");
const F1155 = require("../artifacts/contracts/FujiERC1155/FujiERC1155.sol/FujiERC1155.json");
const Flasher = require("../artifacts/contracts/Flashloans/Flasher.sol/Flasher.json");
const Controller = require("../artifacts/contracts/Controller.sol/Controller.json");

// Providers Artifacts

const Aave = require("../artifacts/contracts/Providers/ProviderAave.sol/ProviderAave.json");
const Compound = require("../artifacts/contracts/Providers/ProviderCompound.sol/ProviderCompound.json");
const Dydx = require("../artifacts/contracts/Providers/ProviderDYDX.sol/ProviderDYDX.json");
const IronBank = require("../artifacts/contracts/Providers/ProviderIronBank.sol/ProviderIronBank.json");
const Fuse3 = require("../artifacts/contracts/Providers/ProviderFuse3.sol/ProviderFuse3.sol.json");
const Fuse18 = require("../artifacts/contracts/Providers/ProviderFuse18.sol/ProviderFuse18.sol.json");

const getERC20Contract = async (asset) => {
  let erc20Contract = await ethers.getContractAt("IERC20", asset));
  return erc20Contract;
};

const fixedFixture = async ([wallet]) => {

  // Deploy: Functional Contracts
  const fujiadmin = await deployContract(wallet, FujiAdmin, []);
  const fliquidator = await deployContract(wallet, Fliquidator, []);
  const flasher = await deployContract(wallet, Flasher, []);
  const controller = await deployContract(wallet, Controller, []);
  const f1155 = await deployContract(wallet, F1155, []);
  const oracle = await deployContract(wallet, FujiOracle, [
    Object.values(ASSETS).map((asset) => asset.address),
    Object.values(ASSETS).map((asset) => asset.oracle),
  ]);

  // Deploy: harvester Contract
  const vaultharvester = await deployContract(wallet, VaultHarvester, []);

  // General Plug-ins and Set-up Transactions
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury(TREASURY_ADDR);
  await fujiadmin.setController(controller.address);
  await fujiadmin.setVaultHarvester(vaultharvester.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setSwapper(UNISWAP_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(fliquidator.address, true);

  return {
    fujiadmin,
    fliquidator,
    flasher,
    controller,
    f1155,
    oracle,
    vaultharvester
  };
};

const timeTravel = async (seconds) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
};

const advanceblocks = async (blocks) => {
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine");
  }
};

const evmSnapshot = async () => ethers.provider.send("evm_snapshot", []);
const evmRevert = async (id) => ethers.provider.send("evm_revert", [id]);

const fundTheBootstrapper = async(bootstraper, fundingDeposit, assets) => {

  const arrayOfAssets = Object.values(ASSETS).map((asset) => asset.address);
  const fundprovider = await deployContract(bootstraper, Compound, []);
  await fundprovider.connect(bootstraper).deposit(
    "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    fundingDeposit,
    {value:fundingDeposit}
  );

  for (var i = 0; i < arrayOfAssets.length; i++) {
    if(arrayOfAssets[i] != "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" ) {


    }
  }


}

module.exports = {
  getERC20Contract,
  fixture,
  timeTravel,
  advanceblocks,
  TREASURY_ADDR,
  ZERO_ADDR,
  ASSETS,
  Aave,
  Compound,
  Dydx,
  IronBank,
  Fuse3,
  Fuse18,
  evmSnapshot,
  evmRevert,
};
