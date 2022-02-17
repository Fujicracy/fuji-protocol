// Goal: initialize a chain w/ events to test the game
// const ora = require("ora");

const { getContractAddress } = require("../utils");
const { ethers } = require("hardhat");

// global.progressPrefix = __filename.split("/").pop();
// global.progress = ora().start(progressPrefix + ": Starting...");
// global.console.log = (...args) => {
//   progress.text = `${progressPrefix}: ${args.join(" ")}`;
// };

// la premiere addresse genereree par ganache stockera les contracts
// les signers des transactions peuvent etre l'une des 10 addresses par ganache
// pour faire les transaction, on va impersonner mon adresse metamask
// si les addresses ne changent pas pas besoin d'imperssoner

// TODO: Private key should be an arg of the script or in env
// const provider = ethers.providers.getDefaultProvider("ropsten");
const main = async () => {
  // 1. credit metamask account
  // console.log("Crediting user account");
  // const tx = await sendTransaction();
  // console.log(`Sent ${ethers.utils.formatEther(tx.value)}eth to ${tx.to}`);

  // 2. then borrow
  console.log("Borrowing w/ user account");
  borrow();


  // 3. then forward time
};

async function sendTransaction(to, amount) {
  // const wallet = new ethers.Wallet(
  //   // Private key of ganache-cli (1) account
  //   "0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1"
  // );
  const [, wallet] = await ethers.getSigners(); // ganache-cli (1) account
  const provider = ethers.providers.getDefaultProvider("http://localhost:8545");

  const transaction = {
    to: "0x5246EaDEa6925eF6A861e3e2860665306a8A6233", // Mmask user address
    value: ethers.utils.parseEther("10"),
  };

  return wallet.sendTransaction(transaction);
}

async function borrow() {
  const provider = ethers.providers.getDefaultProvider("http://localhost:8545");
  // ethers.contracts.NFTGame.

  console.log(ethers);
  // const contract = ethers.contracts.Fuji;

  // return Promise.resolve();
}

main();
