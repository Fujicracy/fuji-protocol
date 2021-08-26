const chalk = require("chalk");
const fs = require("fs");
const hre = require("hardhat");
const R = require("ramda");

const { ethers, upgrades, artifacts } = hre;
const { utils, provider } = ethers;

const ASSETS = {
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    oracle: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
  },
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    oracle: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    oracle: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
  },
  ETH: {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    oracle: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  },
  FEI: {
    name: "fei",
    nameUp: "FEI",
    address: "0x956F47F50A910163D8BF957Cf5846D573E7f87CA",
    oracle: "0x31e0a88fecB6eC0a411DBe0e9E76391498296EE9",
  },
};

const SUSHI_ROUTER_ADDR = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";

let deploymentsPath = "core.deploy"; // by default

const setDeploymentsPath = async (market) => {
  const network = await provider.getNetwork();
  deploymentsPath = `${hre.config.paths.artifacts}/${network.chainId}-${market}.deploy`;
};

const getDeployments = async (name) => {
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

const redeployIf = async (name, contractName, shouldRedeploy, deployContract, args = []) => {
  const deployer = (await ethers.getSigners())[0];

  const currentDeployment = await getDeployments(name);
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

module.exports = {
  deploy,
  deployProxy,
  setDeploymentsPath,
  getDeployments,
  updateDeployments,
  redeployIf,
  callIf,
  ASSETS,
  SUSHI_ROUTER_ADDR,
};
