const { deploy, redeployIf, network } = require("../utils");

const deployVaultHarvester = async () => {
  let name;
  switch (network) {
    case "mainnet":
      name = "VaultHarvester";
      break;
    case "fantom":
      name = "VaultHarvesterFTM";
      break;
    case "polygon":
      name = "VaultHarvesterMATIC";
      break;
    default:
      break;
  }

  let contractName;
  switch (network) {
    case "mainnet":
      contractName = "VaultHarvester";
      break;
    case "fantom":
      contractName = "VaultHarvesterFTM";
      break;
    case "polygon":
      contractName = "VaultHarvesterMATIC";
      break;
    default:
      break;
  }

  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deployVaultHarvester,
};
