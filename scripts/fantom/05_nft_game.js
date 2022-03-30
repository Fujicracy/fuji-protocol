const chalk = require("chalk");
const ora = require("ora");
const { ethers } = require("hardhat");
const { provider } = ethers;

const { WrapperBuilder } = require("redstone-evm-connector");

const { deployNFTGame } = require("../tasks/deployNFTGame");
const { deployNFTInteractions } = require("../tasks/deployNFTInteractions");
const { deployPreTokenBonds } = require("../tasks/deployPreTokenBonds")
const { updateNFTGame } = require("../tasks/updateNFTGame");
const { updateNFTInteractions } = require("../tasks/updateNFTInteractions");
const { updatePreTokenBonds } = require("../tasks/updatePreTokenBonds");

const { 
  setDeploymentsPath,
  network,
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

const getVaultsAddrs = (network) => {
  if (network == "fantom") {
    const vaultftmdai = getContractAddress("VaultFTMDAI");
    const vaultftmusdc = getContractAddress("VaultFTMUSDC");
    const vaultwethdai = getContractAddress("VaultWETHDAI");
    const vaultwethusdc = getContractAddress("VaultWETHUSDC");
    const vaultwbtcdai = getContractAddress("VaultWBTCDAI");
    return [
      vaultftmdai,
      vaultftmusdc,
      vaultwethdai,
      vaultwethusdc,
      vaultwbtcdai
    ];
  } else {
    return [];
  }
};

const TESTING_PARAMS = true;

/// Fixed Game Parameters
const POINTS_DECIMALS = 5;
const CRATE_COMMON_ID =1;
const CRATE_EPIC_ID = 2;
const CRATE_LEGENDARY_ID = 3;
const CRATE_IDS = [
  CRATE_COMMON_ID,
  CRATE_EPIC_ID,
  CRATE_LEGENDARY_ID
];

const MULTISIG = "0x40578F7902304e0e34d7069Fb487ee57F841342e";

/**
 * Deploys and sets-up the {NFTGame} and {NFTInteractions} contracts
 */
const deployContracts = async () => {
  console.log("📡 Deploying...");

  const now = (await provider.getBlock("latest")).timestamp;

  const week = 60 * 60 * 24 * 7;
  const day = 60 * 60 * 24;

  let prices = [];
  let rewardfactors = [];
  let phases = [];
  // 0 = start game launch
  // 1 = end of accumulation
  // 2 = end of trade and lock
  // 3 = end of bond
  if(TESTING_PARAMS) {
    phases = [
      now,
      now + 4 * day,
      now + 5 * day,
      now + 6 * day
    ];
    prices = [2, 4, 8].map( i => parseUnits(i, POINTS_DECIMALS));
    rewardfactors = [
      [1, 0, 1, 2, 25],
      [1, 0, 1, 4, 50],
      [1, 0, 1, 8, 100],
    ];
  } else {
    // Production parameters
    const LaunchTimestamp = 1649419200;
    phases = [
      LaunchTimestamp,
      LaunchTimestamp + 8 * week,
      LaunchTimestamp + 10 * week,
      LaunchTimestamp + 12 * week
    ];
    prices = [2000, 10000, 20000].map( i => parseUnits(i, POINTS_DECIMALS));
    rewardfactors = [
    // Note that 'standard' rewards chances are:
    // 50%, 20%, 20%, 5%, 0.01%
      [1,    0,  1.2, 2, 25 ], // CrateId = 1 
      [1,    0,  1.4, 4, 50 ], // CrateId = 2
      [1, 0.25, 1.8,  8, 100], // CrateId = 3
    ];
  }
  
  // Functions below return string addresses
  let nftgame = await deployNFTGame([phases]);
  let nftinteractions = await deployNFTInteractions([nftgame]);
  let pretokenbonds = await deployPreTokenBonds([POINTS_DECIMALS, nftgame]);
  
  // Build etherjs contracts again
  nftgame = await ethers.getContractAt("NFTGame", nftgame);
  nftinteractions = await ethers.getContractAt("NFTInteractions", nftinteractions);
  pretokenbonds = await ethers.getContractAt("PreTokenBonds", pretokenbonds);

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
  let vaults =[];
  let adminAddress;
  if (TESTING_PARAMS) {
    // Entropy check bypassed in testing
    await nftinteractions.setMaxEntropyDelay(60 * 60 * 24 * 365 * 2);
    vaults = getVaultsAddrs();
    vaults = !vaults[0] ? [] : vaults[0];
    adminAddress = nftgame.signer.address;
  } else {
    vaults = getVaultsAddrs();
    adminAddress = MULTISIG;
  }

  await updateNFTGame(nftgame.address, nftinteractions.address, vaults, adminAddress);
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
    TESTING_PARAMS
  );

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
