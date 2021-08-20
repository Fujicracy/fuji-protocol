const { deploy, redeployIf } = require("../utils");

const deployController = async () => {
  const name = "Controller";
  const contractName = "Controller";
  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deployController,
};
