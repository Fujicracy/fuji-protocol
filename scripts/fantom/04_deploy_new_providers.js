const chalk = require("chalk");
const ora = require("ora");
const { deployProvider } = require("../tasks/deployProvider");
const { setDeploymentsPath, network, getContractAddress } = require("../utils");
const { ASSETS } = require("./consts");

global.progressPrefix = __filename.split("/").pop()
global.progress = ora().start(progressPrefix + ": Starting...");
global.console.log = (...args) => {
  progress.text = `${progressPrefix}: ${args.join(" ")}`;
}

const NEW_PROVIDERS = [
  "ProviderHundred",
  "ProviderAaveV3FTM"
  // Add new provider smart contract name to this array
];

const deployContracts = async ()   => {
  console.log("📡 Deploying...");

  // Script will skip providers that have not changed and have already been deployed.
  for (let index = 0; index < NEW_PROVIDERS.length; index++) {
    const address = await deployProvider(NEW_PROVIDERS[index]);
    console.debug(NEW_PROVIDERS[index], address);
  }

  progress.succeed(progressPrefix);
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
