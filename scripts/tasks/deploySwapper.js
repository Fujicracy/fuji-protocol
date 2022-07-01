const { deploy, redeployIf, networkSuffix } = require("../utils");

const deploySwapper = async () => {
  const name = networkSuffix("Swapper");
  const contractName = networkSuffix("Swapper");

  const deployed = await redeployIf(name, contractName, deploy);
  return deployed;
};

const deployF2Swapper = async (args) => {
  const name = networkSuffix("F2Swapper");
  const contractName = "F2Swapper";

  const deployed = await redeployIf(name, contractName, deploy, args);
  return deployed;
};

module.exports = {
  deploySwapper,
  deployF2Swapper,
};
