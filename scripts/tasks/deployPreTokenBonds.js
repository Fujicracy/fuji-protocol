const { deployProxy, redeployIf } = require("../utils");

const deployPreTokenBonds = async (args) => {
  const name = "PreTokenBonds";
  const contractName = "PreTokenBonds";
  const deployed = await redeployIf(name, contractName, deployProxy, args);
  return deployed;
};

module.exports = {
  deployPreTokenBonds,
};
