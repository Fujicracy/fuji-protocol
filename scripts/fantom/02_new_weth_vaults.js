const chalk = require("chalk");
const { deployVault } = require("../tasks/deployVault");
const { updateFujiERC1155 } = require("../tasks/updateFujiERC1155");
const { updateVault } = require("../tasks/updateVault");
const { setDeploymentsPath, network, getContractAddress } = require("../utils");
const { ASSETS } = require("./consts");

const deployContracts = async () => {
  console.log("\n\n 📡 Deploying...\n");

  const fujiadmin = getContractAddress("FujiAdmin");
  const oracle = getContractAddress("FujiOracle");
  const f1155 = getContractAddress("FujiERC1155");

  const vaultwethdai = await deployVault("VaultWETHDAI", [
    fujiadmin,
    oracle,
    ASSETS.WETH.address,
    ASSETS.DAI.address,
  ]);

  const vaultwethusdc = await deployVault("VaultWETHUSDC", [
    fujiadmin,
    oracle,
    ASSETS.WETH.address,
    ASSETS.USDC.address,
  ]);

  await updateFujiERC1155(f1155, [vaultwethdai, vaultwethusdc]);

  const geist = getContractAddress("ProviderGeist");
  const cream = getContractAddress("ProviderCream");
  const scream = getContractAddress("ProviderScream");

  // Vault Set-up
  await updateVault("VaultWETHDAI", vaultwethdai, {
    providers: [geist, cream, scream],
    fujiadmin,
    f1155,
  });

  await updateVault("VaultWETHUSDC", vaultwethusdc, {
    providers: [geist, cream, scream],
    fujiadmin,
    f1155,
  });

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
