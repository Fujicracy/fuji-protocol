const { ethers } = require("hardhat");
const { callIf } = require("../utils");

const updateFlasher = async (flasher, fujiadmin) => {
  const flasherContract = await ethers.getContractAt("Flasher", flasher);

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
