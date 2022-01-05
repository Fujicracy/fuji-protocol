const { deployProxy, redeployIf, network } = require("../utils");

const deployVault = async (name, args) => {
  const contractName = network === "fantom" ? "FujiVaultFTM" : "FujiVault";

  const deployed = await redeployIf(name, contractName, () => false, deployProxy, args);

  // Call initialize function of the implementation contract if it's not already called.
  // This is a precaution measure to make sure a malicious actor won't take control
  // of the implementation contract.
  const implAddr = await upgrades.erc1967.getImplementationAddress(deployed);
  const implContract = await ethers.getContractAt(contractName, implAddr);
  const implOwner = await implContract.owner();
  if (implOwner === "0x0000000000000000000000000000000000000000") {
    await implContract.initialize(...args);
    console.log(`Implementation contract ${contractName}: initialized`);
  }

  return deployed;
};

module.exports = {
  deployVault,
};
