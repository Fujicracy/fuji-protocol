const { deployProxy, redeployIf, network } = require("../utils");

const deployVault = async (name, args) => {
  const contractName = network === "fantom" ? "FujiVaultFTM" : "FujiVault";

  const deployed = await redeployIf(name, contractName, () => false, deployProxy, args);
  return deployed;
};

module.exports = {
  deployVault,
};
