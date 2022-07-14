const chalk = require("chalk");
const ora = require("ora");
const { deployController } = require("../tasks/deployController");
const { deployFlasher } = require("../tasks/deployFlasher");
const { deployF2Fliquidator } = require("../tasks/deployFliquidator");
const { deployFujiAdmin } = require("../tasks/deployFujiAdmin");
const { deployFujiERC1155 } = require("../tasks/deployFujiERC1155");
const { deployFujiOracle } = require("../tasks/deployFujiOracle");
const { deployProvider } = require("../tasks/deployProvider");
const { deployF2Swapper } = require("../tasks/deploySwapper");
const { deployF2Vault } = require("../tasks/deployVault");
const { deployVaultHarvester } = require("../tasks/deployVaultHarvester");
const { updateController } = require("../tasks/updateController");
const { updateFlasher } = require("../tasks/updateFlasher");
const { updateFujiAdmin } = require("../tasks/updateFujiAdmin");
const { updateFujiERC1155 } = require("../tasks/updateFujiERC1155");
const { updateFujiFliquidator } = require("../tasks/updateFujiFliquidator");
const { updateVault } = require("../tasks/updateVault");
const { setDeploymentsPath, network } = require("../utils");
const { ASSETS, SUSHISWAP_ROUTER_ADDR } = require("./consts");

global.progressPrefix = __filename.split("/").pop();
global.progress = ora().start(progressPrefix + ": Starting...");
global.console.log = (...args) => {
  progress.text = `${progressPrefix}: ${args.join(" ")}`;
}

const deployContracts = async () => {
  console.log("📡 Deploying...");

  const treasury = "0x89c1E94F47c4e3a374B5a98455468f27CA2b2544";
  // Functional Contracts
  const fujiadmin = await deployFujiAdmin();
  const fliquidator = await deployF2Fliquidator();
  const flasher = await deployFlasher();
  const controller = await deployController();
  const f1155 = await deployFujiERC1155();
  const oracle = await deployFujiOracle([
    Object.values(ASSETS).map((asset) => asset.address),
    Object.values(ASSETS).map((asset) => asset.oracle),
  ]);

  // Provider Contracts
  const aaveV3Arbitrum = await deployProvider("ProviderAaveV3Arbitrum");
  const dForceArbitrum = await deployProvider("ProviderDForceArbitrum");
  const wepiggyArbitrum = await deployProvider("ProviderWePiggyArbitrum");

  // Deploy Core Money Handling Contracts
  // const vaultharvester = await deployVaultHarvester();
  const swapper = await deployF2Swapper([ASSETS.WETH.address, SUSHISWAP_ROUTER_ADDR]);

  const vaultethdai = await deployF2Vault("VaultETHDAI", [
    fujiadmin,
    oracle,
    ASSETS.ETH.address,
    ASSETS.DAI.address,
  ]);
  const vaultethusdc = await deployF2Vault("VaultETHUSDC", [
    fujiadmin,
    oracle,
    ASSETS.ETH.address,
    ASSETS.USDC.address,
  ]);

  const vaultusdceth = await deployF2Vault("VaultUSDCETH", [
    fujiadmin,
    oracle,
    ASSETS.USDC.address,
    ASSETS.ETH.address,
  ]);

  // General Plug-ins and Set-up Transactions
  await updateFujiAdmin(fujiadmin, {
    flasher,
    fliquidator,
    treasury,
    controller,
    // vaultharvester,
    swapper,
  });

  await updateFujiFliquidator(fliquidator, {
    fujiadmin,
    oracle,
    swapper: SUSHISWAP_ROUTER_ADDR,
  });
  await updateFlasher(flasher, fujiadmin);
  await updateController(controller, fujiadmin);
  await updateFujiERC1155(f1155, [
    vaultethdai,
    vaultethusdc,
    vaultusdceth,
    fliquidator,
  ]);

  // Vault Set-up
  await updateVault("VaultETHDAI", vaultethdai, {
    providers: [aaveV3Arbitrum, dForceArbitrum],
    fujiadmin,
    f1155,
  });
  await updateVault("VaultETHUSDC", vaultethusdc, {
    providers: [aaveV3Arbitrum, dForceArbitrum, wepiggyArbitrum],
    fujiadmin,
    f1155,
  });

  await updateVault("VaultUSDCETH", vaultusdceth, {
    providers: [aaveV3Arbitrum, dForceArbitrum, wepiggyArbitrum],
    fujiadmin,
    f1155,
  });

  progress.succeed(progressPrefix);
};

const main = async () => {
  if (network !== "arbitrum") {
    throw new Error("Please set 'NETWORK=arbitrum' in ./packages/hardhat/.env");
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
