require("dotenv").config();

const chalk = require("chalk");
const { ethers } = require("hardhat");
const { getContractAddress, setDeploymentsPath, network } = require("../utils");

const provider = ethers.providers.getDefaultProvider("http://localhost:8545");

async function main() {
  if (network !== "fantom") {
    throw new Error("Please set 'NETWORK=fantom' in ./packages/hardhat/.env");
  }
  await setDeploymentsPath("core");

  await initTestWallet();
}

async function initTestWallet() {
  const amount = "20"; // 100 token in ganache-cli signer

  console.log("Sending tokens to test wallet...");
  const tx = await creditTestWallet(amount);
  console.log(`Sent ${ethers.utils.formatEther(tx.value)} tokens to ${tx.to}`);

  // console.log("Borrowing w/ user account...");
  // const event = await depositAndBorrow(String(amount - 1));
  // console.log(`Borrowed ${ethers.utils.formatEther(event.value)} tokens`);

  console.log("Crediting user w/ meter points...");
  await creditMeterPoints(20000000);
  console.log("Crediting user w/ legendary crates...");
  await creditLegendaryCrates(20);
  console.log("Crediting user w/ NFT tokenId 6 ...");
  await creditNFT(2, 6);

  //console.log("Forwarding time...");
  //const seconds = 60 * 60 * 24 * 7;
  //await ethers.provider.send("evm_increaseTime", [seconds]);
  //await ethers.provider.send("evm_mine");
  //console.log(`Forwarded time ${seconds} (${seconds / 60 / 60 / 24} days) later`);
}

async function creditTestWallet(amount) {
  if (!process.env.TEST_WALLET_ADDRESS) {
    throw new Error("Error: missing TEST_WALLET_ADDRESS in .env");
  }
  const [, wallet] = await ethers.getSigners(); // ganache-cli (1) account
  const transaction = {
    to: process.env.TEST_WALLET_ADDRESS,
    value: ethers.utils.parseEther(amount),
  };

  return wallet.sendTransaction(transaction);
}

async function depositAndBorrow(amount) {
  if (!process.env.TEST_WALLET_PRIVATE_KEY) {
    throw new Error("Error: missing TEST_WALLET_PRIVATE_KEY in .env");
  }
  const userWallet = new ethers.Wallet(process.env.TEST_WALLET_PRIVATE_KEY, provider);
  const vaultAddress = getContractAddress("VaultFTMDAI");
  const vaultFTMDAI = await ethers.getContractAt("FujiVaultFTM", vaultAddress);

  const depositAmount = ethers.utils.parseUnits(amount, 18);
  const borrowAmount = ethers.utils.parseUnits(amount, 18);

  return vaultFTMDAI
    .connect(userWallet)
    .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });
}

async function creditMeterPoints(amount) {
  const userWallet = new ethers.Wallet(process.env.TEST_WALLET_PRIVATE_KEY, provider);

  const nftGameAddress = getContractAddress("NFTGame");
  const nftgame = await ethers.getContractAt("NFTGame", nftGameAddress);

  await nftgame.mint(userWallet.address, 0, amount);
}

async function creditLegendaryCrates(amount) {
  const userWallet = new ethers.Wallet(process.env.TEST_WALLET_PRIVATE_KEY, provider);

  const nftGameAddress = getContractAddress("NFTGame");
  const nftgame = await ethers.getContractAt("NFTGame", nftGameAddress);

  await nftgame.mint(userWallet.address, 3, amount);
}

async function creditNFT(amount, id) {
  const userWallet = new ethers.Wallet(process.env.TEST_WALLET_PRIVATE_KEY, provider);

  const nftGameAddress = getContractAddress("NFTGame");
  const nftgame = await ethers.getContractAt("NFTGame", nftGameAddress);

  await nftgame.mint(userWallet.address, id, amount);
}

main().catch((error) => {
  console.error(chalk.red(`\n${error}\n`));
  process.exit(1);
});
