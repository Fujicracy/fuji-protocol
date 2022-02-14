const chalk = require("chalk");
const ora = require("ora");
const { deployVaultHarvester } = require("../tasks/deployVaultHarvester");
const { updateFujiAdmin } = require("../tasks/updateFujiAdmin");
const { setDeploymentsPath, network, getContractAddress } = require("../utils");
const { ASSETS } = require("./consts");

global.progress = ora();

const deployContracts = async () => {
  progress.text = "📡 Deploying...";
  progress.start();
  // console.log("\n\n 📡 Deploying...\n");

  const fujiadmin = getContractAddress("FujiAdmin");
  const vaultharvester = await deployVaultHarvester();

  await updateFujiAdmin(fujiadmin, { vaultharvester });

  // console.log("Finished!");
  progress.succeed(__filename.split("/").pop());
};

const main = async () => {
  if (network !== "fantom") {
    throw new Error("Please set 'NETWORK=fantom' in ./packages/hardhat/.env");
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
