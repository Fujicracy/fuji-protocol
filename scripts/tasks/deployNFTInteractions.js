const fs = require("fs");
const hre = require("hardhat");
const { ethers, upgrades, artifacts } = hre;

const { getDeployments, updateDeployments } = require("../utils");

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

const redeployWithExternalLibrary = async (name, contractName, deployContract, args = [], options = {}, library = {}) => {
  const currentDeployment = getDeployments(name);
  const contractArtifacts = await artifacts.readArtifact(contractName);
  const addr = currentDeployment.address ?? "0x0000000000000000000000000000000000000000";
  const checkExistance = await ethers.provider.getCode(addr);

  if (
    checkExistance !== "0x" &&
    currentDeployment.bytecode === contractArtifacts.bytecode &&
    JSON.stringify(currentDeployment.abi) === JSON.stringify(contractArtifacts.abi)
  ) {
    progress.text = name + ": Skipping...";
    // console.log(name + ": Skipping...");
    return currentDeployment.address;
  }

  progress.text = name + ": Deploying...";
  // console.log(name + ": Deploying...");
  const deployed = await deployContract(name, contractName, args, options, library);
  progress.text = name + ": Deployed at" + deployed.address;
  // console.log(name + ": Deployed at", deployed.address);
  return deployed.address;
};

const deployProxyWithExternalLibrary = async (name, contractName, args = [], overrides = {}, libraries = {}) => {
  const contractArgs = args || [];
  const externalLibraries = libraries || {};
  const proxyOverrides = overrides || {};
  console.debug("externalLibraries", libraries, "proxyOverrides", proxyOverrides);
  const contractArtifacts = await ethers.getContractFactory(contractName, externalLibraries);
  const deployed = await upgrades.deployProxy(contractArtifacts, [...contractArgs], proxyOverrides);
  await deployed.deployed();

  const initializeFunction = Object.keys(contractArtifacts.interface.functions).find((fname) =>
    fname.startsWith("initialize")
  );
  const encoded = ethers.utils.defaultAbiCoder.encode(
    contractArtifacts.interface.functions[initializeFunction].inputs,
    contractArgs
  );
  fs.writeFileSync(`artifacts/${name}.address`, deployed.address);

  await updateDeployments(name, contractName, deployed.address);

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${name}.args`, encoded.slice(2));

  return deployed;
};

module.exports = {
  deployNFTInteractions,
};
