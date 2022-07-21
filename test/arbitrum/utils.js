const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

const { getContractAt, getContractFactory } = ethers;

const SUSHISWAP_ROUTER_ADDR = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
const TREASURY_ADDR = "0x89c1E94F47c4e3a374B5a98455468f27CA2b2544"; // Deployer

const DEBUG = false;

const ASSETS = {
  ETH: {
    name: "eth",
    nameUp: "ETH",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    oracle: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    aTokenV3: "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8",
    decimals: 18,
  },
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    oracle: "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB",
    aTokenV3: "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
    decimals: 18,
  },
  USDC: {
    name: "usdc",
    nameUp: "USDC",
    address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    oracle: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
    aTokenV3: "0x625E7708f30cA75bfd92586e17077590C60eb4cD",
    decimals: 6,
  },
  WETH: {
    name: "weth",
    nameUp: "WETH",
    address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    oracle: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    aTokenV3: "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8",
    decimals: 18,
  },
  WBTC: {
    name: "wbtc",
    nameUp: "WBTC",
    address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    oracle: "0x6ce185860a4963106506C203335A2910413708e9",
    aTokenV3: "0x078f358208685046a11C85e8ad32895DED33A249",
    decimals: 8,
  },
};

// iterate through all ASSETS and create pairs
const getVaults = () => {
  const assets = Object.values(ASSETS);
  const vaults = [];
  assets.forEach((collateral, i1) => {
    assets.forEach((debt, i2) => {
      if (i1 !== i2) {
        vaults.push({
          name: `vault${collateral.name}${debt.name}`,
          collateral,
          debt,
        });
      }
    });
  });
  return vaults;
};

// console.log(getVaults());

const fixture = async ([wallet]) => {
  // Step 0: Common
  const tokens = {};
  for (const asset in ASSETS) {
    tokens[`${ASSETS[asset].name}`] = await getContractAt("IERC20", ASSETS[asset].address);
  }
  const swapper = await getContractAt("IUniswapV2Router02", SUSHISWAP_ROUTER_ADDR);
  const arbitrumWrapper = await getContractAt(
    "contracts/interfaces/IWETH.sol:IWETH",
    ASSETS.WETH.address
  );

  // Step 1: Base Contracts
  const FujiAdmin = await getContractFactory("FujiAdmin");
  const fujiadmin = await upgrades.deployProxy(FujiAdmin, []);

  const Fliquidator = await getContractFactory("F2Fliquidator");
  const fliquidator = await Fliquidator.deploy([]);

  const Flasher = await getContractFactory("FlasherArbitrum");
  const flasher = await Flasher.deploy([]);

  const Controller = await getContractFactory("Controller");
  const controller = await Controller.deploy([]);

  const F1155 = await getContractFactory("FujiERC1155");
  const f1155 = await upgrades.deployProxy(F1155, []);

  const FujiOracle = await getContractFactory("FujiOracle");
  const oracle = await FujiOracle.deploy(
    Object.values(ASSETS).map((asset) => asset.address),
    Object.values(ASSETS).map((asset) => asset.oracle)
  );

  // Step 2: Providers
  const ProviderAaveV3Arbitrum = await getContractFactory("ProviderAaveV3Arbitrum");
  const aavev3 = await ProviderAaveV3Arbitrum.deploy([]);
  const ProviderWePiggyArbitrum = await getContractFactory("ProviderWePiggyArbitrum");
  const wepiggy = await ProviderWePiggyArbitrum.deploy([]);
  const ProviderDForceArbitrum = await getContractFactory("ProviderDForceArbitrum");
  const dforce = await ProviderDForceArbitrum.deploy([]);

  // Log if debug is set true
  if (DEBUG) {
    console.log("fujiadmin", fujiadmin.address);
    console.log("fliquidator", fliquidator.address);
    console.log("flasher", flasher.address);
    console.log("controller", controller.address);
    console.log("f1155", f1155.address);
    console.log("oracle", oracle.address);
    console.log("wepiggy", wepiggy.address);
    console.log("aavev3", aavev3.address);
    console.log("dforce", dforce.address);
  }

  // Setp 3: Vaults
  const FujiVault = await getContractFactory("F2FujiVault");
  // deploy a vault for each entry in ASSETS
  const vaults = {};
  for (const { name, collateral, debt } of getVaults()) {
    const vault = await upgrades.deployProxy(FujiVault, [
      fujiadmin.address,
      oracle.address,
      collateral.address,
      debt.address,
    ]);

    if (DEBUG) {
      console.log(name, vault.address);
    }

    await f1155.setPermit(vault.address, true);
    await vault.setFujiERC1155(f1155.address);
    await fujiadmin.allowVault(vault.address, true);
    await vault.setProviders([wepiggy.address, aavev3.address, dforce.address]);

    vaults[name] = vault;
  }

  // Step 4: Setup
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury(TREASURY_ADDR);
  await fujiadmin.setController(controller.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setSwapper(SUSHISWAP_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(fliquidator.address, true);

  return {
    ...tokens,
    ...vaults,
    wepiggy,
    aavev3,
    dforce,
    oracle,
    fujiadmin,
    fliquidator,
    flasher,
    controller,
    f1155,
    swapper,
    arbitrumWrapper,
  };
};

module.exports = {
  fixture,
  ASSETS,
  VAULTS: getVaults(),
};
