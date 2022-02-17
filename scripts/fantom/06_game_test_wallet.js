// Goal: initialize a chain w/ events to test the game
require("dotenv").config();
const { ethers } = require("hardhat");
const { getContractAddress, setDeploymentsPath } = require("../utils");

const provider = ethers.providers.getDefaultProvider("http://localhost:8545");

async function main() {
  await setDeploymentsPath("core");

  const amount = "20"; // 100 token in ganache-cli signer

  console.log("Sending tokens to test wallet...");
  const tx = await creditTestWallet(amount);
  console.log(`Sent ${ethers.utils.formatEther(tx.value)} tokens to ${tx.to}`);

  console.log("Borrowing w/ user account...");
  const event = await depositAndBorrow(amount);
  console.log(`Borrowed ${ethers.utils.formatEther(event.value)} tokens`);

  // 3. then forward time
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

main()
  .catch(console.error)
  .finally(() => console._ora.stop());
