const { ethers, upgrades } = require("hardhat");
const { getContractFactory } = ethers;

const SUSHI_ROUTER_ADDR = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const TREASURY_ADDR = "0x9F5A10E45906Ef12497237cE10fB7AB9B850Ff86";
const AWETH_ADDR = "0x030bA81f1c18d280636F32af80b9AAd02Cf0854e";
const CETH_ADDR = "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5";
const CYWETH_ADDR = "0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393";

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
};

const fixture = async ([wallet]) => {
  const dai = await ethers.getContractAt("IERC20", ASSETS.DAI.address);
  const usdc = await ethers.getContractAt("IERC20", ASSETS.USDC.address);
  const usdt = await ethers.getContractAt("IERC20", ASSETS.USDT.address);
  const aweth = await ethers.getContractAt("IERC20", AWETH_ADDR);
  const ceth = await ethers.getContractAt("ICErc20", CETH_ADDR);
  const cyweth = await ethers.getContractAt("ICErc20", CYWETH_ADDR);

  // Step 1 of Deploy: Contracts which address is required to be hardcoded in other contracts
  // Fuji Mapping, for testing this is not required.
  // const fujimapping = await deployContract(wallet, FujiMapping,[]);
  // const treasury = await deployContract(wallet, Treasury, []);

  // Step 2 Of Deploy: Functional Contracts
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

  // Step 3 Of Deploy: Provider Contracts
  const Aave = await getContractFactory("ProviderAave");
  const aave = await Aave.deploy([]);
  const Compound = await getContractFactory("ProviderCompound");
  const compound = await Compound.deploy([]);
  const DyDx = await getContractFactory("ProviderDYDX");
  const dydx = await DyDx.deploy([]);
  const IronBank = await getContractFactory("ProviderIronBank");
  const ironbank = await IronBank.deploy([]);

  // Step 4 Of Deploy Core Money Handling Contracts
  const Harvester = await getContractFactory("VaultHarvester");
  const vaultharvester = await Harvester.deploy([]);
  const FujiSwapper = await getContractFactory("Swapper");
  const swapper = await FujiSwapper.deploy([]);

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
  const vaultdaiusdc = await upgrades.deployProxy(FujiVault, [
    fujiadmin.address,
    oracle.address,
    ASSETS.DAI.address,
    ASSETS.USDC.address,
  ]);
  const vaultusdcdai = await upgrades.deployProxy(FujiVault, [
    fujiadmin.address,
    oracle.address,
    ASSETS.USDC.address,
    ASSETS.DAI.address,
  ]);
  const vaultdaiusdt = await upgrades.deployProxy(FujiVault, [
    fujiadmin.address,
    oracle.address,
    ASSETS.DAI.address,
    ASSETS.USDT.address,
  ]);
  const vaultdaieth = await upgrades.deployProxy(FujiVault, [
    fujiadmin.address,
    oracle.address,
    ASSETS.DAI.address,
    ASSETS.ETH.address,
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
  await fliquidator.setSwapper(SUSHI_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(fliquidator.address, true);
  await f1155.setPermit(vaultdai.address, true);
  await f1155.setPermit(vaultusdc.address, true);
  await f1155.setPermit(vaultusdt.address, true);
  await f1155.setPermit(vaultdaiusdc.address, true);
  await f1155.setPermit(vaultusdcdai.address, true);
  await f1155.setPermit(vaultdaiusdt.address, true);
  await f1155.setPermit(vaultdaieth.address, true);

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

  await vaultdaiusdc.setProviders([compound.address, aave.address, dydx.address]);
  await vaultdaiusdc.setActiveProvider(compound.address);
  await vaultdaiusdc.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultdaiusdc.address, true);

  await vaultusdcdai.setProviders([compound.address, aave.address, dydx.address]);
  await vaultusdcdai.setActiveProvider(compound.address);
  await vaultusdcdai.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultusdcdai.address, true);

  await vaultdaiusdt.setProviders([compound.address, aave.address]);
  await vaultdaiusdt.setActiveProvider(compound.address);
  await vaultdaiusdt.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultdaiusdt.address, true);

  await vaultdaieth.setProviders([compound.address, aave.address, dydx.address]);
  await vaultdaieth.setActiveProvider(compound.address);
  await vaultdaieth.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultdaieth.address, true);

  return {
    dai,
    usdc,
    usdt,
    aweth,
    ceth,
    cyweth,
    oracle,
    fujiadmin,
    fliquidator,
    flasher,
    controller,
    f1155,
    aave,
    compound,
    dydx,
    ironbank,
    vaultharvester,
    swapper,
    vaultdai,
    vaultusdc,
    vaultusdt,
    vaultdaiusdc,
    vaultusdcdai,
    vaultdaiusdt,
    vaultdaieth,
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

const parseUnits = (amount, decimals = 18) => ethers.utils.parseUnits(`${amount}`, decimals);
const parseUnitsOfCurrency = async (tokenAddr, amount) => {
  const token = await ethers.getContractAt("IERC20Extended", tokenAddr);
  const decimals = (await token.decimals()).toString();

  return ethers.utils.parseUnits(`${amount}`, decimals);
};

const formatUnitsToNum = (amount, decimals = 18) =>
  Number(ethers.utils.formatUnits(amount, decimals));
const formatUnitsOfCurrency = async (tokenAddr, amount) => {
  const token = await ethers.getContractAt("IERC20Extended", tokenAddr);
  const decimals = (await token.decimals()).toString();

  return ethers.utils.formatUnits(amount, decimals);
};

const toBN = (amount) => ethers.BigNumber.from(`${amount}`);

const evmSnapshot = async () => ethers.provider.send("evm_snapshot", []);
const evmRevert = async (id) => ethers.provider.send("evm_revert", [id]);

module.exports = {
  fixture,
  timeTravel,
  advanceblocks,
  parseUnits,
  parseUnitsOfCurrency,
  formatUnitsToNum,
  formatUnitsOfCurrency,
  toBN,
  ZERO_ADDR,
  ASSETS,
  TREASURY_ADDR,
  SUSHI_ROUTER_ADDR,
  evmSnapshot,
  evmRevert,
};
