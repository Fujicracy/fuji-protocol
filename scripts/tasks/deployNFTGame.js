const { ethers } = require("hardhat");
const { deployProxy, deploy, redeployIf, redeployWithExternalLibrary } = require("../utils");

const deployNFTGame = async (args) => {
  const name = "NFTGame";
  const contractName = "NFTGame";
  const deployed = await redeployIf(name, contractName, deployProxy, args);

  // Deploy on-chain metadata descriptor for Lock NFT.
  const metadataContracts = await deployLockNFTDescriptor(deployed);
  
  // Check if LockNFTDescriptor address is not set.
  const nftgame = await ethers.getContractAt(contractName, deployed);
  const checkAddr = await nftgame.lockNFTdesc();
  if (checkAddr == ethers.constants.AddressZero) {
    const tx =  await nftgame.setLockNFTDescriptor(metadataContracts.descriptor);
    await tx.wait();
  }
  return deployed;
};

/**
 * The lock NFT descriptor is a module smart contract to generate on-chain metadata in {NFTGame.sol}
 */
 const deployLockNFTDescriptor = async (nftgameAddr) => {
  const svgName = "LockSVG";
  const svgContractName = "LockSVG";
  const proxyOpts = {
    kind: 'uups'
  }
  const svgDeployed = await redeployWithExternalLibrary(svgName, svgContractName, deployProxy, [nftgameAddr], proxyOpts);

  const descriptorName = "LockNFTDescriptor";
  const desprictorContractName = "LockNFTDescriptor";
  const descriptorDeployed = await redeployIf(descriptorName, desprictorContractName, deploy, [nftgameAddr, svgDeployed]);
  return {
    descriptor: descriptorDeployed,
    svg: svgDeployed
  };
};

module.exports = {
  deployNFTGame,
  deployLockNFTDescriptor
};
