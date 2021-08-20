const { deploy, redeployIf } = require("../utils");

const deployFliquidator = async () => {
  const name = "Fliquidator";
  const contractName = "Fliquidator";
  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deployFliquidator,
};
