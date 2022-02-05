const { deploy, redeployIf } = require("../utils");

const deployFujiOracle = async (args) => {
  const name = "FujiOracle";
  const contractName = "FujiOracle";
  const deployed = await redeployIf(name, contractName, deploy, args);
  return deployed;
};

module.exports = {
  deployFujiOracle,
};
