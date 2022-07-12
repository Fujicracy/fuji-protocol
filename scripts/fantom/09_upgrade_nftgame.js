const chalk = require("chalk");
const { defender } = require('hardhat');
const { setDeploymentsPath, network, getContractAddress } = require("../utils");

// ref: https://docs.openzeppelin.com/defender/guide-upgrades
const upgrade = async () => {
  const NFTGame = await ethers.getContractFactory("NFTGame");
  const addr = getContractAddress("NFTGame");
  console.log("Creating proposal for upgrading NFTGame...");
  const overrides = {
    unsafeAllowRenames: true
  }
  const proposal = await defender.proposeUpgrade(addr, NFTGame, overrides);
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
