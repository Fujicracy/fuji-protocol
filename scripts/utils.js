const chalk = require("chalk");
const fs = require("fs");
const hre = require("hardhat");
const R = require("ramda");

const { ethers, upgrades, artifacts } = hre;
const { utils, provider } = ethers;

const network = process.env.NETWORK;

let deploymentsPath = "core.deploy"; // by default

const setDeploymentsPath = async (market) => {
  const netw = await provider.getNetwork();
  deploymentsPath = `${hre.config.paths.artifacts}/${netw.chainId}-${market}.deploy`;
};

const getDeployments = (name) => {
  let deployData;
  if (fs.existsSync(deploymentsPath)) {
    deployData = JSON.parse(fs.readFileSync(deploymentsPath).toString());
  } else {
    deployData = {};
  }

  return deployData[name] || {};
};

const updateDeployments = async (name, contractName, address) => {
  let deployData;
  if (fs.existsSync(deploymentsPath)) {
    deployData = JSON.parse(fs.readFileSync(deploymentsPath).toString());
  } else {
    deployData = {};
  }

  const contractArtifacts = await artifacts.readArtifact(contractName);
  deployData[name] = {
    address,
    abi: contractArtifacts.abi,
    bytecode: contractArtifacts.bytecode,
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployData, null, 2));
};

const getContractAddress = (name) => {
  return getDeployments(name).address;
};

/**
 * Deploy a contract if it has not been deployed, otherwise read address from hardhat artifacts folder.
 * @param {string} name same as contractName, except for FujiVaults. 
 * @param {string} contractName name of the compiled contract.
 * @param {Function} deployContract function call type {deploy, deployProxy}.
 * @param {Array} args arguments required in contract constructor or initializer.
 * @returns {Promise} resolves to 'string' address of the deployed contract.
 */
const redeployIf = async (name, contractName, deployContract, args = []) => {
  const currentDeployment = getDeployments(name);
  const contractArtifacts = await artifacts.readArtifact(contractName);
  const addr = currentDeployment.address ?? "0x0000000000000000000000000000000000000000";
  const checkExistance = await ethers.provider.getCode(addr);

  if (
    checkExistance !== "0x" &&
    currentDeployment.bytecode === contractArtifacts.bytecode &&
    JSON.stringify(currentDeployment.abi) === JSON.stringify(contractArtifacts.abi)
  ) {
    console.log(name + ": Skipping...");
    return currentDeployment.address;
  }
  console.log(name + ": Deploying...");
  const deployed = await deployContract(name, contractName, args);
  console.log(name + ": Deployed at", deployed.address);
  return deployed.address;
};

const callIf = async (name, shouldCall, call) => {
  if (!(await shouldCall())) {
    console.log(name + ": Skipping...");
  } else {
    console.log(name + ": Setting...");
    await call();
  }
};

/**
 * Extension of {redeployIf} to include external libraries. See {redeployIf}.
 * @dev Same parameters as {redeployIf} + options object + library object
 * @returns {Promise} resolves to 'string' address of the deployed contract.
 */
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
    console.log(name + ": Skipping...");
    return currentDeployment.address;
  }

  console.log(name + ": Deploying...");
  const deployed = await deployContract(name, contractName, args, options, library);
  console.log(name + ": Deployed at", deployed.address);
  return deployed.address;
};

// abi encodes contract arguments
// useful when you want to manually verify the contracts
// for example, on Etherscan
const abiEncodeArgs = (deployed, contractArgs) => {
  // not writing abi encoded args if this does not pass
  if (!contractArgs || !deployed || !R.hasPath(["interface", "deploy"], deployed)) {
    return "";
  }
  const encoded = utils.defaultAbiCoder.encode(deployed.interface.deploy.inputs, contractArgs);
  return encoded;
};

// proxy deploy
const deployProxy = async (name, contractName, args = [], overrides = {}) => {
  const contractArgs = args || [];
  const contractArtifacts = await ethers.getContractFactory(contractName);
  const deployed = await upgrades.deployProxy(contractArtifacts, contractArgs, overrides);
  await deployed.deployed();

  const initializeFunction = Object.keys(contractArtifacts.interface.functions).find((fname) =>
    fname.startsWith("initialize")
  );
  const encoded = utils.defaultAbiCoder.encode(
    contractArtifacts.interface.functions[initializeFunction].inputs,
    contractArgs
  );
  fs.writeFileSync(`artifacts/${name}.address`, deployed.address);

  await updateDeployments(name, contractName, deployed.address);

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${name}.args`, encoded.slice(2));

  return deployed;
};

// proxy deploy with external library
const deployProxyWithExternalLibrary = async (name, contractName, args = [], overrides = {}, libraries = {}) => {
  const contractArgs = args || [];
  const externalLibraries = libraries || {};
  const proxyOverrides = overrides || {};
  console.debug("externalLibraries", libraries, "proxyOverrides", proxyOverrides);
  const contractArtifacts = await ethers.getContractFactory(contractName, externalLibraries);
  const deployed = await upgrades.deployProxy(contractArtifacts, contractArgs, proxyOverrides);
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

// contract deploy
const deploy = async (name, contractName, args = [], overrides = {}) => {
  const contractArgs = args || [];
  const contractFactory = await ethers.getContractFactory(contractName);
  const deployed = await contractFactory.deploy(...contractArgs, overrides);
  await deployed.deployed();

  const encoded = abiEncodeArgs(deployed, contractArgs);
  fs.writeFileSync(`artifacts/${name}.address`, deployed.address);

  await updateDeployments(name, contractName, deployed.address);

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${name}.args`, encoded.slice(2));

  return deployed;
};

const upgradeProxy = async (name, contractName) => {
  const addr = getContractAddress(name);
  const factory = await ethers.getContractFactory(contractName);
  const upgraded = await upgrades.upgradeProxy(addr, factory);
  const tx = await upgraded.deployTransaction.wait();

  console.log(`${name}: upgraded`);
  console.log(`Tx: ${tx.transactionHash}`);
  return addr;
};

const copyMinedTxParams = async (txHash) => {
  const reftx = await provider.getTransaction(txHash);
  let unsignedTx = {
    maxFeePerGas: reftx.maxFeePerGas,
    maxPriorityFeePerGas: reftx.maxPriorityFeePerGas,
    chainId: reftx.chainId
  }
  return unsignedTx;
}

const networkSuffix = (name) => {
  switch (network) {
    case "mainnet":
      return name;
    case "fantom":
      return name + "FTM";
    case "polygon":
      return name + "MATIC";
    case "arbitrum":
      return name + "Arbitrum";
    default:
      return ""
  }
}

module.exports = {
  deploy,
  deployProxy,
  deployProxyWithExternalLibrary,
  upgradeProxy,
  setDeploymentsPath,
  getDeployments,
  getContractAddress,
  updateDeployments,
  redeployIf,
  redeployWithExternalLibrary,
  callIf,
  copyMinedTxParams,
  networkSuffix,
  network,
};
