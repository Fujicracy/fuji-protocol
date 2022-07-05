const { ethers } = require("hardhat");

const { getContractAt } = ethers;

const vaultsAddresses = [
  "0x5eE3fD04f2afafCe1d4263503fA6389064171694",
  "0xF9108a79516D2f2f9f68f960011e4e30Cc7C0Ab0",
];

(async () => {
  for (let i = 0; i < vaultsAddresses.length; i++) {
    const vault = await getContractAt("F2FujiVault", vaultsAddresses[i]);
    console.log("Using vault: " + vault.address);
    console.log("Provider: " + (await vault.activeProvider()));
    // const tx = await vault.depositAndBorrow("10000000000000000", "10", {
    // value: "10000000000000000",
    // gasLimit: 1250000,
    // });
    const tx = await vault.withdraw("10", { gasLimit: 1250000 });
    console.log(tx);
  }
})();
