const { ethers } = require("hardhat");
const { callIf } = require("../utils");

const updateFujiFliquidator = async (fliquidator, params) => {
  const fliquidatorContract = await ethers.getContractAt("Fliquidator", fliquidator);
  const { fujiadmin, oracle, swapper } = params;

  if (fujiadmin) {
    await callIf(
      "setFujiAdmin",
      () => true,
      async () => {
        await fliquidatorContract.setFujiAdmin(fujiadmin);
      }
    );
  }

  if (oracle) {
    await callIf(
      "setFujiOracle",
      () => true,
      async () => {
        await fliquidatorContract.setFujiOracle(oracle);
      }
    );
  }

  if (swapper) {
    await callIf(
      "setFujiOracle",
      async () => (await fliquidatorContract.swapper()) !== swapper,
      async () => {
        await fliquidatorContract.setSwapper(swapper);
      }
    );
  }
};

module.exports = {
  updateFujiFliquidator,
};
