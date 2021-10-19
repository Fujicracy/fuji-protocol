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

  const vaultwbtcdai = await deployVault("VaultWBTCDAI", [
    fujiadmin,
    oracle,
    ASSETS.WBTC.address,
    ASSETS.DAI.address,
  ]);
  const vaultwbtcusdc = await deployVault("VaultWBTCUSDC", [
    fujiadmin,
    oracle,
    ASSETS.WBTC.address,
    ASSETS.USDC.address,
  ]);

   //General Plug-ins and Set-up Transactions
  await updateFujiERC1155(f1155, [vaultwbtcdai, vaultwbtcusdc]);

  // Vault Set-up
  await updateVault("VaultWBTCDAI", vaultwbtcdai, {
    providers: [cream, scream],
    fujiadmin,
    f1155,
  });
  await updateVault("VaultWBTCUSDC", vaultwbtcusdc, {
    providers: [cream, scream],
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
