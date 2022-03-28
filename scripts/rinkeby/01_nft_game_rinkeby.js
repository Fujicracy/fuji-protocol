require("dotenv").config();
const chalk = require("chalk");
const { ethers } = require("hardhat");
const { provider } = ethers;

const { deployNFTGame } = require("../tasks/deployNFTGame");
const { deployNFTInteractions } = require("../tasks/deployNFTInteractions");
const { updateNFTGame } = require("../tasks/updateNFTGame");
const { updateNFTInteractions } = require("../tasks/updateNFTInteractions");

const { 
  setDeploymentsPath,
  network,
  redeployIf,
  deploy
} = require("../utils");

const deployPointFaucet = async () => {
  const name = "PointFaucet";
  const contractName = "PointFaucet";
  const deployed = await redeployIf(name, contractName, deploy);
  if (!deployed.deployTransaction) {
    return deployed;
  } else {
    await deployed.deployTransaction.wait(5);
    return deployed;
  }
};

const updatePointFaucet = async (pointfaucetAddresss, nftgameAddress) => {
  const pointfaucet = await ethers.getContractAt("PointFaucet", pointfaucetAddresss);
  const nftGameResponse = await pointfaucet.nftGame();
  
  if (!nftGameResponse) {
    const tx = await pointfaucet.setNFTGame(nftgameAddress);
    await tx.wait(5);
    console.log("Faucet nftGame address set-up complete");
  } else {
    console.log("Faucet nftGame address already set-up");
  }

  const nftgame = await ethers.getContractAt("NFTGame", nftgameAddress);
  const GAME_INTERACTOR = await nftgame.GAME_INTERACTOR();
  const hasRole = await nftgame.hasRole(GAME_INTERACTOR, pointfaucet.address);

  if (!hasRole) {
    const tx1 = await nftgame.grantRole(GAME_INTERACTOR, pointfaucet.address);
    await tx1.wait(5);
    console.log("Faucet role GAME_INTERACTOR assigned in Nftgame complete");
  } else {
    console.log("Faucet role GAME_INTERACTOR already assigned.");
  }
  
};

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

  const nftgame = await deployNFTGame([phases]);
  const nftinteractions = await deployNFTInteractions([nftgame.address]);

  // 'pointfaucet' only required for Rinkeby
  let pointfaucet = await deployPointFaucet();

  console.log("network", network);
  await updateNFTGame(nftgame, nftinteractions, network);
  await updatePointFaucet(pointfaucet, nftgame);

  // Note that 'standard' rewards chances:
  // 50%, 20%, 20%, 5%, 0.01%
  const rewardfactors = [
    [0, 0, 1, 2, 25], // CrateId = 1 
    [0, 0, 1, 4, 50], // CrateId = 2
    [0, 0, 1, 8, 100] // CrateId = 3
  ];

  // This price array will be scaled by 'ethers.utils.parseUnits()'
  // According to 'POINTS_DECIMALS()' in NFTGame.sol
  const prices = [2, 4, 8];

  await updateNFTInteractions(nftinteractions, nftgame, rewardfactors, prices);

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