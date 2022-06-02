const chalk = require("chalk");
const { defender } = require('hardhat');
const { setDeploymentsPath, network, getContractAddress } = require("../utils");

const { LIB_PSEUDORANDOM } = require("./consts");

// ref: https://docs.openzeppelin.com/defender/guide-upgrades
const upgrade = async () => {
  const library = {
    libraries: {
      LibPseudoRandom: LIB_PSEUDORANDOM, // fantom
    }
  };
  const NFTInteractions = await ethers.getContractFactory("NFTInteractions", library);
  const addr = getContractAddress("NFTInteractions");
  console.log("Creating proposal for upgrading NFTInteractions...");
  const override = {
    unsafeAllow: ['external-library-linking']
  }
  const proposal = await defender.proposeUpgrade(addr, NFTInteractions, override);
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
