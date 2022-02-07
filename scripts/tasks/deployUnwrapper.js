const { deploy, redeployIf, network } = require("../utils");

const deployUnwrapper = async () => {
  const name = network === "fantom" ? "WFTMUnwrapper" : "WETHUnwrapper";
  const contractName = network === "fantom" ? "WFTMUnwrapper" : "WETHUnwrapper";

  const deployed = await redeployIf(name, contractName, deploy);
  return deployed;
};

module.exports = {
  deployUnwrapper,
};
