const { ethers } = require("hardhat");
const { callIf, networkSuffix } = require("../utils");

const updateVault = async (name, vault, params) => {
  const { providers, fujiadmin, f1155 } = params;

  const contractName = "F2FujiVault";

  const vaultContract = await ethers.getContractAt(contractName, vault);

  if (providers && providers.length > 0) {
    await callIf(
      name + " setProviders",
      async () => JSON.stringify(await vaultContract.getProviders()) !== JSON.stringify(providers),
      async () => {
        let tx = await vaultContract.setProviders(providers);
        await tx.wait();
      }
    );
  }

  if (providers && providers.length > 0) {
    await callIf(
      name + " setActiveProvider",
      async () => (await vaultContract.activeProvider()) !== providers[0],
      async () => {
        let tx = await vaultContract.setActiveProvider(providers[0]);
        await tx.wait();
      }
    );
  }

  if (f1155) {
    await callIf(
      name + " setFujiERC1155",
      async () => (await vaultContract.fujiERC1155()) !== f1155,
      async () => {
        let tx = await vaultContract.setFujiERC1155(f1155);
        await tx.wait();
      }
    );
  }

  if (fujiadmin) {
    const fujiadminContract = await ethers.getContractAt("FujiAdmin", fujiadmin);
    await callIf(
      name + " allowVault",
      async () => !(await fujiadminContract.validVault(vault)),
      async () => {
        let tx = await fujiadminContract.allowVault(vault, true);
        await tx.wait();
      }
    );
  }
};

module.exports = {
  updateVault,
};
