const { deploy, redeployIf, networkSuffix } = require("../utils");

const deployFlasher = async () => {
  const name = networkSuffix("Flasher");
  const contractName = networkSuffix("Flasher");

  const deployed = await redeployIf(name, contractName, deploy);
  return deployed;
};

module.exports = {
  deployFlasher,
};
