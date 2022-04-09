const chalk = require("chalk");
const { defender } = require('hardhat');
const { setDeploymentsPath, network, getContractAddress } = require("../utils");

// ref: https://docs.openzeppelin.com/defender/guide-upgrades
const upgrade = async () => {
  const NFTInteractions = await ethers.getContractFactory("NFTInteractions");
  const addr = getContractAddress("NFTInteractions");
  console.log("Creating proposal for upgrading NFTInteractions...");

  const proposal = await defender.proposeUpgrade(addr, NFTInteractions);
  console.log("Upgrade proposal created at:", proposal.url);
};

const main = async () => {
  if (network !== "fantom") {
    throw new Error("Please set 'NETWORK=fantom' in ./packages/hardhat/.env");
  }

  await setDeploymentsPath("core");
  await upgrade();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red(`\n${error}\n`));
    process.exit(1);
  });
