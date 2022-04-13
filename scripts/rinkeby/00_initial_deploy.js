const chalk = require("chalk");
const ora = require("ora");
const { deployController } = require("../tasks/deployController");
const { deployFlasher } = require("../tasks/deployFlasher");
const { deployFliquidator } = require("../tasks/deployFliquidator");
const { deployFujiAdmin } = require("../tasks/deployFujiAdmin");
const { deployFujiERC1155 } = require("../tasks/deployFujiERC1155");
const { deployFujiOracle } = require("../tasks/deployFujiOracle");
const { deployProvider } = require("../tasks/deployProvider");
const { deployVault } = require("../tasks/deployVault");
const { updateController } = require("../tasks/updateController");
const { updateFlasher } = require("../tasks/updateFlasher");
const { updateFujiAdmin } = require("../tasks/updateFujiAdmin");
const { updateFujiERC1155 } = require("../tasks/updateFujiERC1155");
const { updateFujiFliquidator } = require("../tasks/updateFujiFliquidator");
const { updateVault } = require("../tasks/updateVault");
const { deployProxy, redeployIf, setDeploymentsPath, network } = require("../utils");
const { ASSETS, DEX_ROUTER_ADDR } = require("./consts");

global.progressPrefix = __filename.split("/").pop();
global.progress = ora().start(progressPrefix + ": Starting...");
global.console.log = (...args) => {
  progress.text = `${progressPrefix}: ${args.join(" ")}`;
};

const deployVaultMod = async (name, contractName, args) => {

  const deployed = await redeployIf(name, contractName, deployProxy, args);

  return deployed;
};

const deployContracts = async () => {
  console.log("\n\n 📡 Deploying...\n");

  const treasury = "0xEeD0E86fab975DfE0950940CcEBF700E05ca03f9";
  // Functional Contracts
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
  const compoundMock = await deployProvider("ProviderMockCompound");

  // Deploy Core Money Handling Contracts
  const vaultdaiusdc = await deployVaultMod("VaultDAIUSDC", "FujiVaultFTM", [
    fujiadmin,
    oracle,
    ASSETS.DAI.address,
    ASSETS.USDC.address,
  ]);

  // General Plug-ins and Set-up Transactions
  await updateFujiAdmin(fujiadmin, {
    flasher,
    fliquidator,
    treasury,
    controller
  });
  await updateFujiFliquidator(fliquidator, {
    fujiadmin,
    oracle,
    swapper: DEX_ROUTER_ADDR
  });
  await updateFlasher(flasher, fujiadmin);
  await updateController(controller, fujiadmin);
  await updateFujiERC1155(f1155, [vaultdaiusdc, fliquidator]);

  // Vault Set-up
  await updateVault("VaultDAIUSDC", vaultdaiusdc, {
    providers: [compoundMock],
    fujiadmin,
    f1155,
  });

  progress.text = `Finished!`;
  progress.succeed(progressPrefix);
};

const main = async () => {
  if (network !== "rinkeby") {
    throw new Error("Please set 'NETWORK=rinkeby' in ./packages/hardhat/.env");
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
