const { deployProxy, redeployIf } = require("../utils");

const deployFujiERC1155 = async () => {
  const name = "FujiERC1155";
  const contractName = "FujiERC1155";
  const deployed = await redeployIf(name, contractName, deployProxy);
  return deployed;
};

module.exports = {
  deployFujiERC1155,
};
