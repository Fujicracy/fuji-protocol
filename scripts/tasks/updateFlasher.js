const { ethers } = require("hardhat");
const { callIf, network } = require("../utils");

const updateFlasher = async (flasher, fujiadmin) => {
  const contractName = network === "fantom" ? "FlasherFTM" : "Flasher";
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
