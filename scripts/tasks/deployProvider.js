const { deploy, redeployIf } = require("../utils");

const deployProvider = async (contractName) => {
  const name = contractName;
  const deployed = await redeployIf(name, contractName, deploy);
  return deployed;
};

module.exports = {
  deployProvider,
};
