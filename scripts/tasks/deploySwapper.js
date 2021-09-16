const { deploy, redeployIf } = require("../utils");

const deploySwapper = async () => {
  const name = "Swapper";
  const contractName = "Swapper";
  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deploySwapper,
};
