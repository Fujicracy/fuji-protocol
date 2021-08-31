const { deploy, redeployIf } = require("../utils");

const deployVaultHarvester = async (args) => {
  const name = "VaultHarvester";
  const contractName = "VaultHarvester";
  const deployed = await redeployIf(name, contractName, () => false, deploy, args);
  return deployed;
};

module.exports = {
  deployVaultHarvester,
};
