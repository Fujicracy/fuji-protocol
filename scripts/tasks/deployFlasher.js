const { deploy, redeployIf } = require("../utils");

const deployFlasher = async () => {
  const name = "Flasher";
  const contractName = "Flasher";
  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deployFlasher,
};
