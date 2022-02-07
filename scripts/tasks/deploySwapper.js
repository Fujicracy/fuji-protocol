const { deploy, redeployIf, network } = require("../utils");

const deploySwapper = async () => {
  const name = network === "fantom" ? "SwapperFTM" : "Swapper";
  const contractName = network === "fantom" ? "SwapperFTM" : "Swapper";

  const deployed = await redeployIf(name, contractName, deploy);
  return deployed;
};

module.exports = {
  deploySwapper,
};
