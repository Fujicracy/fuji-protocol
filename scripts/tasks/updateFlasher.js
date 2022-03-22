const { ethers } = require("hardhat");
const { callIf, network } = require("../utils");

const updateFlasher = async (flasher, fujiadmin) => {
  let contractName;
  switch (network) {
    case "mainnet":
      contractName = "Flasher";
      break;
    case "fantom":
      contractName = "FlasherFTM";
      break;
    case "polygon":
      contractName = "FlasherMATIC";
      break;
    default:
      break;
  }
  const flasherContract = await ethers.getContractAt(contractName, flasher);

  if (fujiadmin) {
    await callIf(
      "setFujiAdmin",
      () => true,
      async () => {
        await flasherContract.setFujiAdmin(fujiadmin);
      }
    );
  }
};

module.exports = {
  updateFlasher,
};
