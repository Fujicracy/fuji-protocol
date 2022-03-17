const { deployProxy, redeployIf } = require("../utils");

const deployNFTInteractions = async (args) => {
  const name = "NFTInteractions";
  const contractName = "NFTInteractions";
  const deployed = await redeployIf(name, contractName, deployProxy, args);
  if (!deployed.deployTransaction) {
    return deployed;
  } else {
    await deployed.deployTransaction.wait();
    return deployed;
  }
};

module.exports = {
  deployNFTInteractions,
};
