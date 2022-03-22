const { ethers } = require("hardhat");
const { callIf, network } = require("../utils");

const updateVault = async (name, vault, params) => {
  const { providers, fujiadmin, f1155 } = params;

  let contractName;
  switch (network) {
    case "mainnet":
      contractName = "FujiVault";
      break;
    case "fantom":
      contractName = "FujiVaultFTM";
      break;
    case "polygon":
      contractName = "FujiVaultMATIC";
      break;
    default:
      break;
  }
  const vaultContract = await ethers.getContractAt(contractName, vault);

  if (providers && providers.length > 0) {
    await callIf(
      name + " setProviders",
      async () => JSON.stringify(await vaultContract.getProviders()) !== JSON.stringify(providers),
      async () => {
        await vaultContract.setProviders(providers);
      }
    );
  }

  if (providers && providers.length > 0) {
    await callIf(
      name + " setActiveProvider",
      async () => (await vaultContract.activeProvider()) !== providers[0],
      async () => {
        await vaultContract.setActiveProvider(providers[0]);
      }
    );
  }

  if (f1155) {
    await callIf(
      name + " setFujiERC1155",
      async () => (await vaultContract.fujiERC1155()) !== f1155,
      async () => {
        await vaultContract.setFujiERC1155(f1155);
      }
    );
  }

  if (fujiadmin) {
    const fujiadminContract = await ethers.getContractAt("FujiAdmin", fujiadmin);
    await callIf(
      name + " allowVault",
      async () => !(await fujiadminContract.validVault(vault)),
      async () => {
        await fujiadminContract.allowVault(vault, true);
      }
    );
  }
};

module.exports = {
  updateVault,
};
