const chalk = require("chalk");
const { deployFlasher } = require("../tasks/deployFlasher");
const { updateFlasher } = require("../tasks/updateFlasher");
const { setDeploymentsPath, network, getContractAddress } = require("../utils");
const { ASSETS } = require("./consts");

const deployContracts = async () => {
  console.log("\n\n 📡 Deploying...\n");

  const newflasher = await deployFlasher("FlasherFTM");
  const fujiadminAddress = getContractAddress("FujiAdmin");
  await updateFlasher(newflasher, fujiadminAddress);
  
  console.log("Finished!");
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
