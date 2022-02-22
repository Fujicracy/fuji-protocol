const chalk = require("chalk");
const ora = require("ora");
const { ethers } = require("hardhat");
const { provider } = ethers;
const { setDeploymentsPath, network, getContractAddress, deployProxy } = require("../utils");

global.progressPrefix = __filename.split("/").pop()
global.progress = ora().start(progressPrefix + ": Starting...");
global.console.log = (...args) => {
  progress.text = `${progressPrefix}: ${args.join(" ")}`;
}

const getVaultsAddrs = () => {
  const vaultftmdai = getContractAddress("VaultFTMDAI");
  const vaultftmusdc = getContractAddress("VaultFTMUSDC");
  const vaultwethdai = getContractAddress("VaultWETHDAI");
  const vaultwethusdc = getContractAddress("VaultWETHUSDC");
  const vaultwbtcdai = getContractAddress("VaultWBTCDAI");

  return [vaultftmdai, vaultftmusdc, vaultwethdai, vaultwethusdc, vaultwbtcdai];
};

const deployContracts = async () => {
  console.log("📡 Deploying...");

  const nftgame = await deployProxy("NFTGame", "NFTGame", []);
  console.log("Deployed at " + nftgame.address);

  const nftinteractions = await deployProxy("NFTInteractions", "NFTInteractions", [
    nftgame.address,
  ]);

  await nftgame.grantRole(nftgame.GAME_ADMIN(), nftgame.signer.address);
  await nftgame.grantRole(nftgame.GAME_INTERACTOR(), nftinteractions.address);

  const vaults = getVaultsAddrs();

  for (let i = 0; i < vaults.length; i += 1) {
    const vaultAddr = vaults[i];
    const vault = await ethers.getContractAt("FujiVaultFTM", vaultAddr);
    await vault.setNFTGame(nftgame.address);
  }

  await nftgame.setValidVaults(vaults);

  const now = (await provider.getBlock("latest")).timestamp;
  const week = 60 * 60 * 24 * 7;
  const phases = [
    now,
    now + 1 * week,
    now + 2 * week,
    now + 3 *week
  ];

  const crateIds = [
    await nftinteractions.CRATE_COMMON_ID(),
    await nftinteractions.CRATE_EPIC_ID(),
    await nftinteractions.CRATE_LEGENDARY_ID(),
  ];

  const pointsDecimals = await nftgame.POINTS_DECIMALS();

  // Simplified low crate prices just for testing
  const prices = [2, 4, 8].map((e) => parseUnits(e, pointsDecimals));

  for (let i = 0; i < prices.length; i++) {
    await nftinteractions.setCratePrice(crateIds[i], prices[i]);
  }

  const rewardfactors = [
    [0, 0, 1, 2, 25],
    [0, 0, 1, 4, 50],
  ];

  for (let i = 0; i < rewardfactors.length; i++) {
    await nftinteractions.setCrateRewards(
      crateIds[i],
      rewardfactors[i].map((e) => e * prices[i])
    );
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
