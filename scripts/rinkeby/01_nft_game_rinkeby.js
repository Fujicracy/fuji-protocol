require("dotenv").config();
const chalk = require("chalk");
const ora = require("ora");
const { ethers } = require("hardhat");
const { provider } = ethers;

const { WrapperBuilder } = require("redstone-evm-connector");

const { deployNFTGame } = require("../tasks/deployNFTGame");
const { deployNFTInteractions } = require("../tasks/deployNFTInteractions");
const { deployPreTokenBonds } = require("../tasks/deployPreTokenBonds");
const { updateNFTGame } = require("../tasks/updateNFTGame");
const { updateNFTInteractions } = require("../tasks/updateNFTInteractions");
const { updatePreTokenBonds } = require("../tasks/updatePreTokenBonds");

const { 
  setDeploymentsPath,
  network,
  redeployIf,
  deploy
} = require("../utils");

const { 
  parseUnits 
} = require("../../test/helpers");

global.progressPrefix = __filename.split("/").pop();
global.progress = ora().start(progressPrefix + ": Starting...");
global.console.log = (...args) => {
  progress.text = `${progressPrefix}: ${args.join(" ")}`;
};

const deployPointFaucet = async () => {
  const name = "PointFaucet";
  const contractName = "PointFaucet";
  const deployed = await redeployIf(name, contractName, deploy);
  return deployed;
};

const updatePointFaucet = async (pointfaucetAddresss, nftgameAddress) => {
  const pointfaucet = await ethers.getContractAt("PointFaucet", pointfaucetAddresss);
  const nftGameResponse = await pointfaucet.nftGame();
  
  if (!nftGameResponse) {
    const tx = await pointfaucet.setNFTGame(nftgameAddress);
    await tx.wait(5);
    progress.text = "Faucet nftGame address set-up complete";
  } else {
    progress.text = "Faucet nftGame address already set-up";
  }

  const nftgame = await ethers.getContractAt("NFTGame", nftgameAddress);
  const GAME_INTERACTOR = await nftgame.GAME_INTERACTOR();
  const hasRole = await nftgame.hasRole(GAME_INTERACTOR, pointfaucet.address);

  if (!hasRole) {
    const tx1 = await nftgame.grantRole(GAME_INTERACTOR, pointfaucet.address);
    await tx1.wait(5);
    progress.text = "Faucet role GAME_INTERACTOR assigned in Nftgame complete";
  } else {
    progress.text = "Faucet role GAME_INTERACTOR already assigned.";
  }
};

const getVaultsAddrs = (network) => {
  if (network == 'rinkeby') {
    const vaultethusdc = getContractAddress("VaultETHUSDC");
    return [vaultethusdc];
  } else {
    return [];
  }
};

/// Fixed Game Parameters
const POINTS_DECIMALS = 9;
const CRATE_COMMON_ID =1;
const CRATE_EPIC_ID = 2;
const CRATE_LEGENDARY_ID = 3;
const CRATE_IDS = [
  CRATE_COMMON_ID,
  CRATE_EPIC_ID,
  CRATE_LEGENDARY_ID
];

const deployContracts = async () => {
  console.log("\n\n 📡 Deploying...\n");

  const now = (await provider.getBlock("latest")).timestamp;
  const day = 60 * 60 * 24;
  const phases = [
    now,
    now + 7 * day,
    now + 9 * day,
    now + 11 * day
  ];
  // Note that 'standard' rewards chances:
  // 50%, 20%, 20%, 5%, 0.01%
  const rewardfactors = [
    [1, 0, 0, 2, 25], // CrateId = 1 
    [1, 0, 0, 4, 50], // CrateId = 2
    [1, 0, 0, 8, 100] // CrateId = 3
  ];

  const prices = [2, 4, 8].map( i => parseUnits(i, POINTS_DECIMALS));

  // Functions below return string addresses
  let nftgame = await deployNFTGame([phases]);
  let nftinteractions = await deployNFTInteractions([nftgame.address]);
  let pretokenbonds = await deployPreTokenBonds([POINTS_DECIMALS, nftgame]);

  // Deploy 'pointfaucet'; only required for Rinkeby
  let pointfaucet = await deployPointFaucet();

  // Build etherjs contracts again
  nftgame = await ethers.getContractAt("NFTGame", nftgame);
  nftinteractions = await ethers.getContractAt("NFTInteractions", nftinteractions);
  pretokenbonds = await ethers.getContractAt("PreTokenBonds", pretokenbonds);
  pointfaucet = await ethers.getContractAt("PointsFaucet", pointfaucet);

  // Authorize Redstone entropy signer, if not set.
  const entropyTrustedSigner = await nftinteractions.getTrustedSigner();
  if (entropyTrustedSigner != "0x0C39486f770B26F5527BBBf942726537986Cd7eb") {
    const wrappednftinteractions = WrapperBuilder
    .wrapLite(nftinteractions)
    .usingPriceFeed("redstone", { asset: "ENTROPY" });
    const txA = await wrappednftinteractions.authorizeSignerEntropyFeed("0x0C39486f770B26F5527BBBf942726537986Cd7eb");
    progress.text = `...authorizing Redstone entropy provider tx-hash: ${txA.hash}`;
    await txA.wait();
    progress.text = `succesfully set Redstone entropy signer`;
  } else {
    progress.text = `...skipping Redstone entropy signer is set!`;
  }

  // Get vaults
  console.log("network", network);
  const vaults = getVaultsAddrs(network);
  
  await updateNFTGame(nftgame.address, nftinteractions.address, vaults, nftgame.signer.address);
  await updatePointFaucet(pointfaucet.address, nftgame.address);
  await updateNFTInteractions(nftinteractions.address, CRATE_IDS, rewardfactors, prices);
  await updatePreTokenBonds(
    pretokenbonds.address,
    nftinteractions.address,
    [
      "https://www.example.com/metadata/token/",
      "https://www.example.com/metadata/contract.json",
      "https://www.example.com/metadata/slot/"
    ],
    POINTS_DECIMALS,
    true
  );

  console.log("Finished!");
};

const main = async () => {
  if (network !== "rinkeby") {
    throw new Error("Please set 'NETWORK=rinkeby' in ./packages/hardhat/.env");
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
