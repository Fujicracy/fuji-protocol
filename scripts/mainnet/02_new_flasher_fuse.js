const chalk = require("chalk");
const { deployFlasher } = require("../tasks/deployFlasher");
const { updateFlasher } = require("../tasks/updateFlasher");
const { updateFujiAdmin } = require("../tasks/updateFujiAdmin");
const { setDeploymentsPath, network, getContractAddress } = require("../utils");

const deployContracts = async () => {
  console.log("\n\n 📡 Deploying...\n");

  const fujiadmin = getContractAddress("FujiAdmin");
  const flasher = await deployFlasher();

  //await updateFujiAdmin(fujiadmin, { flasher });
  //await updateFlasher(flasher, fujiadmin);

  console.log("Finished!");
};

const main = async () => {
  if (network !== "mainnet") {
    throw new Error("Please set 'NETWORK=mainnet' in ./packages/hardhat/.env");
  }

  await setDeploymentsPath("fuse");
  await deployContracts();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red(`\n${error}\n`));
    process.exit(1);
  });
