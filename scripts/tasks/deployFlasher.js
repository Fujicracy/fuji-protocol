const { deploy, redeployIf, network } = require("../utils");

const deployFlasher = async () => {
  const name = network === "fantom" ? "FlasherFTM" : "Flasher";
  const contractName = network === "fantom" ? "FlasherFTM" : "Flasher";

  const deployed = await redeployIf(name, contractName, deploy);
  return deployed;
};

module.exports = {
  deployFlasher,
};
