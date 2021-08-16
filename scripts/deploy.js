const chalk = require("chalk");
const { ethers } = require("hardhat");
const { deployProxy, deploy, setMarket, ASSETS } = require("./utils");

const UNISWAP_ROUTER_ADDR = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

const deployContracts = async () => {
  console.log("\n\n 📡 Deploying...\n");

  const deployerWallet = ethers.provider.getSigner();

  // Functional Contracts
  const fujiadmin = await deployProxy("FujiAdmin", "FujiAdmin");
  const fliquidator = await deploy("Fliquidator");
  const flasher = await deploy("Flasher");
  const controller = await deploy("Controller");
  const f1155 = await deployProxy("FujiERC1155", "FujiERC1155", []);
  const oracle = await deploy("FujiOracle", [
    Object.values(ASSETS).map((asset) => asset.address),
    Object.values(ASSETS).map((asset) => asset.oracle),
  ]);

  // Provider Contracts
  const aave = await deploy("ProviderAave");
  const compound = await deploy("ProviderCompound");
  const dydx = await deploy("ProviderDYDX");
  const ironBank = await deploy("ProviderIronBank");

  // Deploy Core Money Handling Contracts
  const vaultharvester = await deploy("VaultHarvester");

  const vaultdai = await deployProxy("VaultETHDAI", "FujiVault", [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.DAI.address,
  ]);
  const vaultusdc = await deployProxy("VaultETHUSDC", "FujiVault", [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.USDC.address,
  ]);
  const vaultusdt = await deployProxy("VaultETHUSDT", "FujiVault", [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.USDT.address,
  ]);

  // General Plug-ins and Set-up Transactions
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury("0x9F5A10E45906Ef12497237cE10fB7AB9B850Ff86");
  await fujiadmin.setController(controller.address);
  await fujiadmin.setVaultHarvester(vaultharvester.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setFujiOracle(oracle.address);
  await fliquidator.setSwapper(UNISWAP_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(vaultdai.address, true);
  await f1155.setPermit(vaultusdc.address, true);
  await f1155.setPermit(vaultusdt.address, true);
  await f1155.setPermit(fliquidator.address, true);

  // Vault Set-up
  await vaultdai.setProviders([compound.address, aave.address, dydx.address, ironBank.address]);
  await vaultdai.setActiveProvider(compound.address);
  await vaultdai.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultdai.address, true);

  await vaultusdc.setProviders([compound.address, aave.address, dydx.address, ironBank.address]);
  await vaultusdc.setActiveProvider(compound.address);
  await vaultusdc.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultusdc.address, true);

  await vaultusdt.setProviders([compound.address, aave.address, ironBank.address]);
  await vaultusdt.setActiveProvider(compound.address);
  await vaultusdt.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultusdt.address, true);

  console.log(
    " 💾  Artifacts (address, abi, and args) saved to: ",
    chalk.blue("artifacts/"),
    "\n\n"
  );
};

const main = async () => {
  setMarket("core");
  await deployContracts();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
