const { ethers } = require("hardhat");
const { callIf, network } = require("../utils");

const updateFujiFliquidator = async (fliquidator, params) => {
  let contractName;
  switch (network) {
    case "mainnet":
      contractName = "Fliquidator";
      break;
    case "fantom":
      contractName = "FliquidatorFTM";
      break;
    case "polygon":
      contractName = "FliquidatorMATIC";
      break;
    default:
      break;
  }
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
