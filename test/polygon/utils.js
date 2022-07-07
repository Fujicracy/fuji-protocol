const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

const { getContractAt, getContractFactory } = ethers;

const SUSHISWAP_ROUTER_ADDR = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
const TREASURY_ADDR = "0xb98d4D4e205afF4d4755E9Df19BD0B8BD4e0f148"; // Deployer

const DEBUG = false;

const ASSETS = {
  MATIC: {
    name: "matic",
    nameUp: "MATIC",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    oracle: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
    aToken: "0x8dF3aad3a84da6b69A4DA8aeC3eA40d9091B2Ac4",
    aTokenV3: "0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97",
    decimals: 18,
  },
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // polygon
    oracle: "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D",
    aToken: "0x27F8D03b3a2196956ED754baDc28D73be8830A6e",
    aTokenV3: "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
    decimals: 18,
  },
  USDC: {
    name: "usdc",
    nameUp: "USDC",
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // polygon
    oracle: "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7",
    aToken: "0x1a13F4Ca1d028320A707D99520AbFefca3998b7F",
    aTokenV3: "0x625E7708f30cA75bfd92586e17077590C60eb4cD",
    decimals: 6,
  },
  WMATIC: {
    name: "wmatic",
    nameUp: "WMATIC",
    address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // polygon
    oracle: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
    aToken: "0x8dF3aad3a84da6b69A4DA8aeC3eA40d9091B2Ac4",
    aTokenV3: "0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97",
    decimals: 18,
  },
  WETH: {
    name: "weth",
    nameUp: "WETH",
    address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // polygon
    oracle: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
    aToken: "0x28424507fefb6f7f8E9D3860F56504E4e5f5f390",
    aTokenV3: "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8",
    decimals: 18,
  },
  WBTC: {
    name: "wbtc",
    nameUp: "WBTC",
    address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", // polygon
    oracle: "0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6",
    aToken: "0x5c2ed810328349100A66B82b78a1791B101C9D61",
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
  const maticWrapper = await getContractAt(
    "contracts/interfaces/IWETH.sol:IWETH",
    ASSETS.WMATIC.address
  );

  // Step 1: Base Contracts
  const FujiAdmin = await getContractFactory("FujiAdmin");
  const fujiadmin = await upgrades.deployProxy(FujiAdmin, []);

  const Fliquidator = await getContractFactory("F2Fliquidator");
  const fliquidator = await Fliquidator.deploy([]);

  const Flasher = await getContractFactory("FlasherMATIC");
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
  const ProviderAaveMATIC = await getContractFactory("ProviderAaveMATIC");
  const aave = await ProviderAaveMATIC.deploy([]);
  const ProviderKashi = await getContractFactory("ProviderKashi");
  const kashi = await ProviderKashi.deploy([]);
  const ProviderWepiggy = await getContractFactory("ProviderWepiggy");
  const wepiggy = await ProviderWepiggy.deploy([]);
  const ProviderAaveV3MATIC = await getContractFactory("ProviderAaveV3MATIC");
  const aavev3 = await ProviderAaveV3MATIC.deploy([]);

  // Log if debug is set true
  if (DEBUG) {
    console.log("fujiadmin", fujiadmin.address);
    console.log("fliquidator", fliquidator.address);
    console.log("flasher", flasher.address);
    console.log("controller", controller.address);
    console.log("f1155", f1155.address);
    console.log("oracle", oracle.address);
    console.log("aave", aave.address);
    console.log("kashi", kashi.address);
    console.log("wepiggy", wepiggy.address);
    console.log("aave", aavev3.address);
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
    await vault.setProviders(
      [
        aave.address,
        kashi.address,
        wepiggy.address,
        aavev3.address
      ]
    );

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
    aave,
    kashi,
    wepiggy,
    aavev3,
    oracle,
    fujiadmin,
    fliquidator,
    flasher,
    controller,
    f1155,
    swapper,
    maticWrapper,
  };
};

module.exports = {
  fixture,
  ASSETS,
  VAULTS: getVaults(),
};
