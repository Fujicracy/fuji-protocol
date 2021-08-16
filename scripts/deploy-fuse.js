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
  const fuse3 = await deploy("ProviderFuse3");
  const fuse6 = await deploy("ProviderFuse6");
  const fuse7 = await deploy("ProviderFuse7");
  const fuse8 = await deploy("ProviderFuse8");
  const fuse18 = await deploy("ProviderFuse18");

  const vaultethfei = await deployProxy("VaultETHFEI", "FujiVault", [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.FEI.address,
  ]);
  const vaultethusdc = await deployProxy("VaultETHUSDC", "FujiVault", [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.USDC.address,
  ]);

  // General Plug-ins and Set-up Transactions
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury("0x9F5A10E45906Ef12497237cE10fB7AB9B850Ff86");
  await fujiadmin.setController(controller.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setFujiOracle(oracle.address);
  await fliquidator.setSwapper(UNISWAP_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(vaultethfei.address, true);
  await f1155.setPermit(vaultethusdc.address, true);
  await f1155.setPermit(fliquidator.address, true);

  // Vaults Set-up
  await vaultethfei.setProviders([fuse8.address]);
  await vaultethfei.setActiveProvider(fuse8.address);
  await vaultethfei.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultethfei.address, true);

  await vaultethusdc.setProviders([fuse7.address]);
  await vaultethusdc.setActiveProvider(fuse7.address);
  await vaultethusdc.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultethusdc.address, true);

  console.log(
    " 💾  Artifacts (address, abi, and args) saved to: ",
    chalk.blue("artifacts/"),
    "\n\n"
  );
};

const main = async () => {
  setMarket("fuse");
  await deployContracts();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
