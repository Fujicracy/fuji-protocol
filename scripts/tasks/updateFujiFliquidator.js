const { ethers } = require("hardhat");
const { callIf, network } = require("../utils");

const updateFujiFliquidator = async (fliquidator, params) => {
  const contractName = network === "fantom" ? "FliquidatorFTM" : "Fliquidator";
  const fliquidatorContract = await ethers.getContractAt(contractName, fliquidator);
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
