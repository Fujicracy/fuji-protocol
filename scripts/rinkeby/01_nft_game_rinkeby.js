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
  deploy,
  getContractAddress
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
    await tx.wait();
    console.log("Faucet nftGame address set-up complete");
  } else {
    console.log("Faucet nftGame address already set-up");
  }

  const nftgame = await ethers.getContractAt("NFTGame", nftgameAddress);
  const GAME_INTERACTOR = await nftgame.GAME_INTERACTOR();
  const hasRole = await nftgame.hasRole(GAME_INTERACTOR, pointfaucet.address);

  if (!hasRole) {
    const tx1 = await nftgame.grantRole(GAME_INTERACTOR, pointfaucet.address);
    await tx1.wait();
    console.log("Faucet role GAME_INTERACTOR assigned in Nftgame complete");
  } else {
    console.log("Faucet role GAME_INTERACTOR already assigned.");
  }
};

const getVaultsAddrs = (network) => {
  if (network == 'rinkeby') {
    const vaultethusdc = getContractAddress("VaultDAIUSDC");
    return [vaultethusdc];
  } else {
    return [];
  }
};

const { LIB_PSEUDORANDOM } = require("./consts");

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
  const gameTimestamps = [
    now,
    now + 7 * day,
    now + 9 * day,
    now + 11 * day
  ];
  // Note that 'standard' rewards chances:
  // 52.50%, 20.00%, 22.50%, 3.99%, 0.01%
  const rewardfactors = [
    [0.25, 0, 1.1, 2, 25], // CrateId = 1 
    [0.25, 0, 1.1, 4, 50], // CrateId = 2
    [0.25, 0, 1.1, 8, 100] // CrateId = 3
  ];

  const prices = [10, 20, 40].map( i => parseUnits(i, POINTS_DECIMALS));
  const merkleRoot = "0xc0decc3b3577dcfe4ac5930eb46aa7201451ebf2e525c6321ef559a079c69482";

  // Functions below return string addresses
  let nftgame = await deployNFTGame([gameTimestamps]);
  const library = {
    libraries: {
      LibPseudoRandom: LIB_PSEUDORANDOM, // rinkeby
    }
  };
  let nftinteractions = await deployNFTInteractions([nftgame], library);
  let pretokenbonds = await deployPreTokenBonds([nftgame]);

  // Deploy 'pointfaucet'; only required for Rinkeby
  let pointfaucet = await deployPointFaucet();

  // Build etherjs contracts again
  nftgame = await ethers.getContractAt("NFTGame", nftgame);
  nftinteractions = await ethers.getContractAt("NFTInteractions", nftinteractions);
  pretokenbonds = await ethers.getContractAt("PreTokenBonds", pretokenbonds);
  pointfaucet = await ethers.getContractAt("PointFaucet", pointfaucet);

  // Authorize Redstone entropy signer, if not set.
  const entropyTrustedSigner = await nftinteractions.getTrustedSigner();
  if (entropyTrustedSigner != "0x0C39486f770B26F5527BBBf942726537986Cd7eb") {
    const wrappednftinteractions = WrapperBuilder
    .wrapLite(nftinteractions)
    .usingPriceFeed("redstone", { asset: "ENTROPY" });
    const txA = await wrappednftinteractions.authorizeSignerEntropyFeed("0x0C39486f770B26F5527BBBf942726537986Cd7eb");
    console.log(`...authorizing Redstone entropy provider tx-hash: ${txA.hash}`);
    await txA.wait();
    console.log(`succesfully set Redstone entropy signer`);
  } else {
    console.log(`...skipping Redstone entropy signer is set!`);
  }

  // Get vaults
  const vaults = getVaultsAddrs(network);
  
  await updateNFTGame(nftgame.address, nftinteractions.address, vaults, nftgame.signer.address, merkleRoot);
  await updatePointFaucet(pointfaucet.address, nftgame.address);
  await updateNFTInteractions(nftinteractions.address, CRATE_IDS, rewardfactors, prices);
  await updatePreTokenBonds(
    pretokenbonds.address,
    nftinteractions.address,
    POINTS_DECIMALS,
    true
  );

  console.log(`Finished!`);
  progress.succeed(progressPrefix);
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
