const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

const { getContractAt, getContractFactory } = ethers;

const SUSHI_ROUTER_ADDR = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const TREASURY_ADDR = "0xb98d4D4e205afF4d4755E9Df19BD0B8BD4e0f148"; // Deployer

const ASSETS = {
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    oracle: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
    aToken: "0x028171bca77440897b824ca71d1c56cac55b68a3",
    decimals: 18,
  },
  USDC: {
    name: "usdc",
    nameUp: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    oracle: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    aToken: "0x9bA00D6856a4eDF4665BcA2C2309936572473B7E",
    decimals: 6,
  },
  USDT: {
    name: "usdt",
    nameUp: "USDT",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    oracle: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
    aToken: "0x71fc860F7D3A592A4a98740e39dB31d25db65ae8",
    decimals: 6,
  },
  ETH: {
    name: "eth",
    nameUp: "ETH",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    oracle: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    aToken: "0x030ba81f1c18d280636f32af80b9aad02cf0854e",
    decimals: 18,
  },
  WETH: {
    name: "weth",
    nameUp: "WETH",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    oracle: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    aToken: "0x030ba81f1c18d280636f32af80b9aad02cf0854e",
    decimals: 18,
  },
  WBTC: {
    name: "wbtc",
    nameUp: "WBTC",
    address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    oracle: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    aToken: "0x9ff58f4ffb29fa2266ab25e75e2a8b3503311656",
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

const fixture = async ([wallet]) => {
  // Step 0: Common
  const tokens = {};
  for (const asset in ASSETS) {
    tokens[`${ASSETS[asset].name}`] = await getContractAt("IERC20", ASSETS[asset].address);
  }
  const swapper = await getContractAt("IUniswapV2Router02", SUSHI_ROUTER_ADDR);

  // Step 1: Base Contracts
  const FujiAdmin = await getContractFactory("FujiAdmin");
  const fujiadmin = await upgrades.deployProxy(FujiAdmin, []);

  const Fliquidator = await getContractFactory("Fliquidator");
  const fliquidator = await Fliquidator.deploy([]);

  const Flasher = await getContractFactory("Flasher");
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

  const Harvester = await getContractFactory("VaultHarvester");
  const harvester = await Harvester.deploy([]);

  const FujiSwapper = await getContractFactory("Swapper");
  const fujiSwapper = await FujiSwapper.deploy([]);

  // Step 2: Providers
  const Compound = await getContractFactory("ProviderCompound");
  const compound = await Compound.deploy([]);
  const Aave = await getContractFactory("ProviderAave");
  const aave = await Aave.deploy([]);
  const DyDx = await getContractFactory("ProviderDYDX");
  const dydx = await DyDx.deploy([]);
  const IronBank = await getContractFactory("ProviderIronBank");
  const ironBank = await IronBank.deploy([]);

  // Setp 3: Vaults
  const FujiVault = await getContractFactory("FujiVault");
  // deploy a vault for each entry in ASSETS
  const vaults = {};
  for (const { name, collateral, debt } of getVaults()) {
    const vault = await upgrades.deployProxy(FujiVault, [
      fujiadmin.address,
      oracle.address,
      collateral.address,
      debt.address,
    ]);
    await f1155.setPermit(vault.address, true);
    await vault.setFujiERC1155(f1155.address);
    await fujiadmin.allowVault(vault.address, true);
    await vault.setProviders(
      [
        compound.address,
        aave.address,
        ironBank.address
      ]
    );

    vaults[name] = vault;
  }

  // Step 4: Setup
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury(TREASURY_ADDR);
  await fujiadmin.setController(controller.address);
  await fujiadmin.setVaultHarvester(harvester.address);
  await fujiadmin.setSwapper(fujiSwapper.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setSwapper(SUSHI_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(fliquidator.address, true);

  return {
    ...tokens,
    ...vaults,
    compound,
    aave,
    dydx,
    ironBank,
    oracle,
    fujiadmin,
    fliquidator,
    flasher,
    controller,
    f1155,
    swapper,
  };
};

module.exports = {
  fixture,
  ASSETS,
  VAULTS: getVaults(),
};
