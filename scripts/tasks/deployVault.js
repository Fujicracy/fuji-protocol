const { deployProxy, redeployIf } = require("../utils");

const deployVault = async (name, args) => {
  const contractName = "FujiVault";
  const deployed = await redeployIf(name, contractName, () => false, deployProxy, args);
  return deployed;
};

module.exports = {
  deployVault,
};
