const { ethers, upgrades } = require("hardhat");

const { getContractAt, getContractFactory } = ethers;

const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const TREASURY_ADDR = "0x9F5A10E45906Ef12497237cE10fB7AB9B850Ff86";
const ASSETS = {
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    oracle: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
    decimals: 18,
  },
  USDC: {
    name: "usdc",
    nameUp: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    oracle: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    decimals: 6,
  },
  USDT: {
    name: "usdt",
    nameUp: "USDT",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    oracle: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
    decimals: 6,
  },
  ETH: {
    name: "eth",
    nameUp: "ETH",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    oracle: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    decimals: 18,
  },
  WETH: {
    name: "weth",
    nameUp: "WETH",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    oracle: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    decimals: 18,
  },
  FEI: {
    name: "fei",
    nameUp: "FEI",
    address: "0x956F47F50A910163D8BF957Cf5846D573E7f87CA",
    oracle: "0x31e0a88fecB6eC0a411DBe0e9E76391498296EE9",
    decimals: 18,
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
  const swapper = await getContractAt("IUniswapV2Router02", UNISWAP_V2_ROUTER);

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

  const WFTMUnwrapper = await getContractFactory("WETHUnwrapper");
  const unwrapper = await WFTMUnwrapper.deploy([]);

  const FujiOracle = await getContractFactory("FujiOracle");
  const oracle = await FujiOracle.deploy(
    Object.values(ASSETS).map((asset) => asset.address),
    Object.values(ASSETS).map((asset) => asset.oracle)
  );

  // Step 2: Providers
  const Fuse3 = await getContractFactory("ProviderFuse3");
  const fuse3 = await Fuse3.deploy([]);
  const Fuse6 = await getContractFactory("ProviderFuse6");
  const fuse6 = await Fuse6.deploy([]);
  const Fuse7 = await getContractFactory("ProviderFuse7");
  const fuse7 = await Fuse7.deploy([]);
  const Fuse8 = await getContractFactory("ProviderFuse8");
  const fuse8 = await Fuse8.deploy([]);
  const Fuse18 = await getContractFactory("ProviderFuse18");
  const fuse18 = await Fuse18.deploy([]);

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

    vaults[name] = vault;
  }

  // Step 4: Setup
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury(TREASURY_ADDR);
  await fujiadmin.setController(controller.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setSwapper(UNISWAP_V2_ROUTER);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(fliquidator.address, true);

  return {
    ...tokens,
    ...vaults,
    fuse3,
    fuse6,
    fuse7,
    fuse8,
    fuse18,
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
