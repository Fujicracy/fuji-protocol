const { ethers } = require("hardhat");
const { callIf } = require("../utils");

const updateController = async (controller, fujiadmin) => {
  const controllerContract = await ethers.getContractAt("Controller", controller);

  if (fujiadmin) {
    await callIf(
      "setFujiAdmin",
      () => true,
      async () => {
        await controllerContract.setFujiAdmin(fujiadmin);
      }
    );
  }
};

module.exports = {
  updateController,
};
