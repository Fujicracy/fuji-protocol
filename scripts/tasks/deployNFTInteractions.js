const fs = require("fs");
const hre = require("hardhat");
const { ethers, upgrades, artifacts } = hre;

const { redeployWithExternalLibrary, deployProxyWithExternalLibrary } = require("../utils");

const deployNFTInteractions = async (args, library) => {
  const name = "NFTInteractions";
  const contractName = "NFTInteractions";
  const override = {
    unsafeAllow: ['external-library-linking']
  }
  const deployed = await redeployWithExternalLibrary(
    name,
    contractName,
    deployProxyWithExternalLibrary,
    args,
    override,
    library
  );
  return deployed;
};

module.exports = {
  deployNFTInteractions,
};
