const { deployProxy, redeployIf } = require("../utils");

const deployNFTGame = async (args) => {
  const name = "NFTGame";
  const contractName = "NFTGame";
  const deployed = await redeployIf(name, contractName, deployProxy, args);
  if (!deployed.deployTransaction) {
    return deployed;
  } else {
    await deployed.deployTransaction.wait();
    const tx = await deployed.grantRole(deployed.GAME_ADMIN(), deployed.signer.address);
    await tx.wait();
    return deployed;
  }
};

module.exports = {
  deployNFTGame,
};
