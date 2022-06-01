const { deploy, redeployIf, networkSuffix } = require("../utils");

const deployVaultHarvester = async () => {
  const name = networkSuffix("VaultHarvester");
  const contractName = networkSuffix("VaultHarvester");

  const deployed = await redeployIf(name, contractName, deploy);
  return deployed;
};

module.exports = {
  deployVaultHarvester,
};
