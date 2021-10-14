const { deploy, redeployIf, network } = require("../utils");

const deployFliquidator = async () => {
  const name = network === "fantom" ? "FliquidatorFTM" : "Fliquidator";
  const contractName = network === "fantom" ? "FliquidatorFTM" : "Fliquidator";

  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deployFliquidator,
};
