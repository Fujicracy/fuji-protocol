const { ethers } = require("hardhat");
const { callIf, networkSuffix } = require("../utils");

const updateFujiFliquidator = async (fliquidator, params) => {
  const contractName = "F2Fliquidator";

  const fliquidatorContract = await ethers.getContractAt(contractName, fliquidator);
  const { fujiadmin, oracle, swapper } = params;

  if (fujiadmin) {
    await callIf(
      "setFujiAdmin",
      () => true,
      async () => {
        let tx = await fliquidatorContract.setFujiAdmin(fujiadmin);
        await tx.wait();
      }
    );
  }

  if (oracle) {
    await callIf(
      "setFujiOracle",
      () => true,
      async () => {
        let tx = await fliquidatorContract.setFujiOracle(oracle);
        await tx.wait();
      }
    );
  }

  if (swapper) {
    await callIf(
      "setFujiOracle",
      async () => (await fliquidatorContract.swapper()) !== swapper,
      async () => {
        let tx = await fliquidatorContract.setSwapper(swapper);
        await tx.wait();
      }
    );
  }
};

module.exports = {
  updateFujiFliquidator,
};
