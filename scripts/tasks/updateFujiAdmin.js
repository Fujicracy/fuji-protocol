const { ethers } = require("hardhat");
const { callIf } = require("../utils");

const updateFujiAdmin = async (fujiadmin, params) => {
  const fujiadminContract = await ethers.getContractAt("FujiAdmin", fujiadmin);
  const { flasher, fliquidator, treasury, controller, vaultharvester, swapper } = params;

  if (flasher) {
    await callIf(
      "setFlasher",
      async () => (await fujiadminContract.getFlasher()) !== flasher,
      async () => {
        await fujiadminContract.setFlasher(flasher);
      }
    );
  }

  if (fliquidator) {
    await callIf(
      "setFliquidator",
      async () => (await fujiadminContract.getFliquidator()) !== fliquidator,
      async () => {
        await fujiadminContract.setFliquidator(fliquidator);
      }
    );
  }

  if (treasury) {
    await callIf(
      "setTreasury",
      async () => (await fujiadminContract.getTreasury()) !== treasury,
      async () => {
        await fujiadminContract.setTreasury(treasury);
      }
    );
  }

  if (controller) {
    await callIf(
      "setController",
      async () => (await fujiadminContract.getController()) !== controller,
      async () => {
        await fujiadminContract.setController(controller);
      }
    );
  }

  if (vaultharvester) {
    await callIf(
      "setVaultHarvester",
      async () => (await fujiadminContract.getVaultHarvester()) !== vaultharvester,
      async () => {
        await fujiadminContract.setVaultHarvester(vaultharvester);
      }
    );
  }

  if (swapper) {
    await callIf(
      "setSwapper",
      async () => (await fujiadminContract.getSwapper()) !== swapper,
      async () => {
        await fujiadminContract.setSwapper(swapper);
      }
    );
  }
};

module.exports = {
  updateFujiAdmin,
};
