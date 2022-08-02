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
        let tx = await fujiadminContract.setFlasher(flasher);
        await tx.wait();
      }
    );
  }

  if (fliquidator) {
    await callIf(
      "setFliquidator",
      async () => (await fujiadminContract.getFliquidator()) !== fliquidator,
      async () => {
        let tx = await fujiadminContract.setFliquidator(fliquidator);
        await tx.wait();
      }
    );
  }

  if (treasury) {
    await callIf(
      "setTreasury",
      async () => (await fujiadminContract.getTreasury()) !== treasury,
      async () => {
        let tx = await fujiadminContract.setTreasury(treasury);
        await tx.wait();
      }
    );
  }

  if (controller) {
    await callIf(
      "setController",
      async () => (await fujiadminContract.getController()) !== controller,
      async () => {
        let tx = await fujiadminContract.setController(controller);
        await tx.wait();
      }
    );
  }

  if (vaultharvester) {
    await callIf(
      "setVaultHarvester",
      async () => (await fujiadminContract.getVaultHarvester()) !== vaultharvester,
      async () => {
        let tx = await fujiadminContract.setVaultHarvester(vaultharvester);
        await tx.wait();
      }
    );
  }

  if (swapper) {
    await callIf(
      "setSwapper",
      async () => (await fujiadminContract.getSwapper()) !== swapper,
      async () => {
        let tx = await fujiadminContract.setSwapper(swapper);
        await tx.wait();
      }
    );
  }
};

module.exports = {
  updateFujiAdmin,
};
