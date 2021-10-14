const chalk = require("chalk");
const { deployController } = require("../tasks/deployController");
const { deployFlasher } = require("../tasks/deployFlasher");
const { deployFliquidator } = require("../tasks/deployFliquidator");
const { deployFujiAdmin } = require("../tasks/deployFujiAdmin");
const { deployFujiERC1155 } = require("../tasks/deployFujiERC1155");
const { deployFujiOracle } = require("../tasks/deployFujiOracle");
const { deployProvider } = require("../tasks/deployProvider");
const { deploySwapper } = require("../tasks/deploySwapper");
const { deployVault } = require("../tasks/deployVault");
const { deployVaultHarvester } = require("../tasks/deployVaultHarvester");
const { updateController } = require("../tasks/updateController");
const { updateFlasher } = require("../tasks/updateFlasher");
const { updateFujiAdmin } = require("../tasks/updateFujiAdmin");
const { updateFujiERC1155 } = require("../tasks/updateFujiERC1155");
const { updateFujiFliquidator } = require("../tasks/updateFujiFliquidator");
const { updateVault } = require("../tasks/updateVault");
const { setDeploymentsPath, network } = require("../utils");
const { ASSETS, SUSHI_ROUTER_ADDR } = require("./consts");

const deployContracts = async () => {
  console.log("\n\n 📡 Deploying...\n");

  // Functional Contracts
  const treasury = "0x9F5A10E45906Ef12497237cE10fB7AB9B850Ff86";
  const fujiadmin = await deployFujiAdmin();
  const fliquidator = await deployFliquidator();
  const flasher = await deployFlasher();
  const controller = await deployController();
  const f1155 = await deployFujiERC1155();
  const oracle = await deployFujiOracle([
    Object.values(ASSETS).map((asset) => asset.address),
    Object.values(ASSETS).map((asset) => asset.oracle),
  ]);

  // Provider Contracts
  const aave = await deployProvider("ProviderAave");
  const compound = await deployProvider("ProviderCompound");
  const dydx = await deployProvider("ProviderDYDX");
  const ironBank = await deployProvider("ProviderIronBank");

  // Deploy Core Money Handling Contracts
  const vaultharvester = await deployVaultHarvester();
  const swapper = await deploySwapper();

  const vaultdai = await deployVault("VaultETHDAI", [
    fujiadmin,
    oracle,
    ASSETS.ETH.address,
    ASSETS.DAI.address,
  ]);
  const vaultusdc = await deployVault("VaultETHUSDC", [
    fujiadmin,
    oracle,
    ASSETS.ETH.address,
    ASSETS.USDC.address,
  ]);
  const vaultusdt = await deployVault("VaultETHUSDT", [
    fujiadmin,
    oracle,
    ASSETS.ETH.address,
    ASSETS.USDT.address,
  ]);

  // General Plug-ins and Set-up Transactions
  await updateFujiAdmin(fujiadmin, {
    flasher,
    fliquidator,
    treasury,
    controller,
    vaultharvester,
    swapper,
  });
  await updateFujiFliquidator(fliquidator, { fujiadmin, oracle, swapper: SUSHI_ROUTER_ADDR });
  await updateFlasher(flasher, fujiadmin);
  await updateController(controller, fujiadmin);
  await updateFujiERC1155(f1155, [vaultdai, vaultusdc, vaultusdt, fliquidator]);

  // Vault Set-up
  await updateVault("VaultETHDAI", vaultdai, {
    providers: [compound, aave, dydx, ironBank],
    fujiadmin,
    f1155,
  });
  await updateVault("VaultETHUSDC", vaultusdc, {
    providers: [compound, aave, dydx, ironBank],
    fujiadmin,
    f1155,
  });
  await updateVault("VaultETHUSDT", vaultusdt, {
    providers: [compound, aave, ironBank],
    fujiadmin,
    f1155,
  });

  console.log("Finished!");
};

const main = async () => {
  if (network !== "mainnet") {
    throw new Error("Please set 'NETWORK=mainnet' in ./packages/hardhat/.env");
  }

  await setDeploymentsPath("core");
  await deployContracts();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red(`\n${error}\n`));
    process.exit(1);
  });
