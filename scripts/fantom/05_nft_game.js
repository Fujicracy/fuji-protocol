const chalk = require("chalk");
const { ethers } = require("hardhat");
const { setDeploymentsPath, network, getContractAddress, deployProxy } = require("../utils");

const getVaultsAddrs = () => {
  const vaultftmdai = getContractAddress("VaultFTMDAI");
  const vaultftmusdc = getContractAddress("VaultFTMUSDC");
  const vaultwethdai = getContractAddress("VaultWETHDAI");
  const vaultwethusdc = getContractAddress("VaultWETHUSDC");
  const vaultwbtcdai = getContractAddress("VaultWBTCDAI");

  return [vaultftmdai, vaultftmusdc, vaultwethdai, vaultwethusdc, vaultwbtcdai];
};

const deployContracts = async () => {
  console.log("\n\n 📡 Deploying...\n");

  console.log("NFTGame: Deploying...");
  const nftgame = await deployProxy("NFTGame", "NFTGame", []);
  console.log("NFTGame: Deployed at", nftgame.address);

  const nftinteractions = await deployProxy("NFTInteractions", "NFTInteractions", [nftgame.address]);

  await nftgame.grantRole(nftgame.GAME_ADMIN(), nftgame.signer.address);
  await nftgame.grantRole(nftgame.GAME_INTERACTOR(), nftinteractions.address);

  const vaults = getVaultsAddrs();

  for (let i = 0; i < vaults.length; i += 1) {
    const vaultAddr = vaults[i];
    const vault = await ethers.getContractAt("FujiVaultFTM", vaultAddr);
    await vault.setNFTGame(nftgame.address);
  }

  await nftgame.setValidVaults(vaults);

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
