const { ethers } = require("hardhat");
const { callIf } = require("../utils");

const updateController = async (controller, fujiadmin) => {
  const controllerContract = await ethers.getContractAt("Controller", controller);

  if (fujiadmin) {
    await callIf(
      "setFujiAdmin",
      () => true,
      async () => {
        let tx = await controllerContract.setFujiAdmin(fujiadmin);
        await tx.wait();
      }
    );
  }
};

module.exports = {
  updateController,
};
