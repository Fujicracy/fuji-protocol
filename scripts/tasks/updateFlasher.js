const { ethers } = require("hardhat");
const { callIf, networkSuffix } = require("../utils");

const updateFlasher = async (flasher, fujiadmin) => {
  const contractName = networkSuffix("Flasher");

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
