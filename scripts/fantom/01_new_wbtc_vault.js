const chalk = require("chalk");
const ora = require("ora");

const { deployVault } = require("../tasks/deployVault");
const { updateFujiERC1155 } = require("../tasks/updateFujiERC1155");
const { updateVault } = require("../tasks/updateVault");
const { setDeploymentsPath, network, getContractAddress } = require("../utils");
const { ASSETS } = require("./consts");

global.progressPrefix = __filename.split("/").pop()
global.progress = ora().start(progressPrefix + ": Starting...");
global.console.log = (...args) => {
  progress.text = `${progressPrefix}: ${args.join(" ")}`;
}

const deployContracts = async () => {
  console.log("📡 Deploying...");

  const fujiadmin = getContractAddress("FujiAdmin");
  const oracle = getContractAddress("FujiOracle");
  const f1155 = getContractAddress("FujiERC1155");

  const vaultwbtcdai = await deployVault("VaultWBTCDAI", [
    fujiadmin,
    oracle,
    ASSETS.WBTC.address,
    ASSETS.DAI.address,
  ]);

  await updateFujiERC1155(f1155, [vaultwbtcdai]);

  const geist = getContractAddress("ProviderGeist");
  const cream = getContractAddress("ProviderCream");
  const scream = getContractAddress("ProviderScream");

  // Vault Set-up
  await updateVault("VaultWBTCDAI", vaultwbtcdai, {
    providers: [geist, cream, scream],
    fujiadmin,
    f1155,
  });

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
