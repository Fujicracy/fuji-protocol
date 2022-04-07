const chalk = require("chalk");
const { defender } = require('hardhat');
const { setDeploymentsPath, network, getContractAddress } = require("../utils");

// ref: https://docs.openzeppelin.com/defender/guide-upgrades
const createProposals = async () => {

  const F1155 = await ethers.getContractFactory("FujiERC1155");
  console.log("Creating proposal for upgrading erc1155...");

  const f1155 = getContractAddress("FujiERC1155");
  const proposal1 = await defender.proposeUpgrade(f1155, F1155);
  console.log("Upgrade proposal created at:", proposal1.url);

  console.log("Creating proposals for upgrading vaults...");
  const Vault = await ethers.getContractFactory("FujiVaultFTM");

  const vaultwethdai = getContractAddress("VaultWETHDAI");
  const proposal2 = await defender.proposeUpgrade(vaultwethdai, Vault);
  console.log("Upgrade proposal created at:", proposal2.url);

  const vaultwethusdc = getContractAddress("VaultWETHUSDC");
  const proposal3 = await defender.proposeUpgrade(vaultwethusdc, Vault);
  console.log("Upgrade proposal created at:", proposal3.url);

  const vaultwbtcdai = getContractAddress("VaultWBTCDAI");
  const proposal4 = await defender.proposeUpgrade(vaultwbtcdai, Vault);
  console.log("Upgrade proposal created at:", proposal4.url);

  const vaultftmdai = getContractAddress("VaultFTMDAI");
  const proposal5 = await defender.proposeUpgrade(vaultftmdai, Vault);
  console.log("Upgrade proposal created at:", proposal5.url);

  const vaultftmusdc = getContractAddress("VaultFTMUSDC");
  const proposal6 = await defender.proposeUpgrade(vaultftmusdc, Vault);
  console.log("Upgrade proposal created at:", proposal6.url);
};

const main = async () => {
  if (network !== "fantom") {
    throw new Error("Please set 'NETWORK=fantom' in ./packages/hardhat/.env");
  }

  await setDeploymentsPath("core");
  await createProposals();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red(`\n${error}\n`));
    process.exit(1);
  });
