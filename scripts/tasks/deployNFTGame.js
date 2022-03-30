const { deployProxy, redeployIf } = require("../utils");

const deployNFTGame = async (args) => {
  const name = "NFTGame";
  const contractName = "NFTGame";
  const deployed = await redeployIf(name, contractName, deployProxy, args);
  return deployed;
};

module.exports = {
  deployNFTGame,
};
