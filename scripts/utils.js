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
  const deployer = (await ethers.getSigners())[0];

  let deployData;
  if (fs.existsSync(deploymentsPath)) {
    deployData = JSON.parse(fs.readFileSync(deploymentsPath).toString());
  } else {
    deployData = {};
  }

  const contractArtifacts = await artifacts.readArtifact(contractName);
  deployData[name] = {
    address,
    deployer: deployer.address,
    abi: contractArtifacts.abi,
    bytecode: contractArtifacts.bytecode,
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployData, null, 2));
};

const getContractAddress = (name) => {
  return getDeployments(name).address;
}

const redeployIf = async (name, contractName, shouldRedeploy, deployContract, args = []) => {
  const deployer = (await ethers.getSigners())[0];

  const currentDeployment = getDeployments(name);
  const contractArtifacts = await artifacts.readArtifact(contractName);

  if (
    currentDeployment.bytecode === contractArtifacts.bytecode &&
    JSON.stringify(currentDeployment.abi) === JSON.stringify(contractArtifacts.abi) &&
    currentDeployment.deployer === deployer.address &&
    !(await shouldRedeploy())
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
  const deployed = await upgrades.deployProxy(contractArtifacts, [...contractArgs], overrides);
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

  // Call initialize function of the implementation contract
  // if it's not already called and renounce ownership.
  // This is a precaution measure to make sure a malicious actor won't take control
  // of the implementation contract.
  const implAddr = await upgrades.erc1967.getImplementationAddress(deployed.address);
  const implContract = await ethers.getContractAt(contractName, implAddr);
  const implOwner = await implContract.owner();
  const signer = await ethers.getSigner();
  if (signer === implOwner) {
    await implContract.initialize(...contractArgs);
    await implContract.renounceOwnership();
  }

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

module.exports = {
  deploy,
  deployProxy,
  upgradeProxy,
  setDeploymentsPath,
  getDeployments,
  getContractAddress,
  updateDeployments,
  redeployIf,
  callIf,
  network,
};
