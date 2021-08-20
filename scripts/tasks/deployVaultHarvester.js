const { deploy, redeployIf } = require("../utils");

const deployVaultHarvester = async () => {
  const name = "VaultHarvester";
  const contractName = "VaultHarvester";
  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deployVaultHarvester,
};
