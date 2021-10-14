const { deploy, redeployIf, network } = require("../utils");

const deployVaultHarvester = async () => {
  const name = network === "fantom" ? "VaultHarvesterFTM" : "VaultHarvester";
  const contractName = network === "fantom" ? "VaultHarvesterFTM" : "VaultHarvester";

  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deployVaultHarvester,
};
