const { deployProxy, redeployIf } = require("../utils");

const deployFujiAdmin = async () => {
  const name = "FujiAdmin";
  const contractName = "FujiAdmin";
  const deployed = await redeployIf(name, contractName, () => false, deployProxy);
  return deployed;
};

module.exports = {
  deployFujiAdmin,
};
