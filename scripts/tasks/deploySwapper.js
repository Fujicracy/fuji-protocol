const { deploy, redeployIf, networkSuffix } = require("../utils");

const deploySwapper = async () => {
  const name = networkSuffix("Swapper");
  const contractName = networkSuffix("Swapper");

  const deployed = await redeployIf(name, contractName, deploy);
  return deployed;
};

module.exports = {
  deploySwapper,
};
