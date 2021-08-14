const chalk = require("chalk");
const fs = require("fs");
const { ethers, upgrades, artifacts } = require("hardhat");
const R = require("ramda");

const { utils, provider, getContractFactory } = ethers;

let market;

// ------ utils -------

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

const updateDeployData = async (name, contractName, address) => {
  const network = await provider.getNetwork();

  const fileName = `${hre.config.paths.artifacts}/${network.chainId}-${market}.deploy`;
  let deployData;
  if (fs.existsSync(fileName)) {
    deployData = JSON.parse(
      fs.readFileSync(fileName).toString()
    );
  } else {
    deployData = {};
  }

  const contractArtifacts = await artifacts.readArtifact(contractName);
  deployData[name] = {
    address,
    abi: contractArtifacts.abi,
    bytecode: contractArtifacts.bytecode,
  };

  fs.writeFileSync(fileName, JSON.stringify(deployData, null, 2));
};

// proxy deploy
const deployProxy = async (proxyName, contractName, _args = [], overrides = {}) => {
  if (!market) {
    throw("ERROR: market is not set, use setMarket()");
  }
  console.log(` 🛰  Deploying: ${proxyName}`);

  const contractArgs = _args || [];
  const contractArtifacts = await ethers.getContractFactory(contractName);
  const deployed = await upgrades.deployProxy(contractArtifacts, [...contractArgs]);
  const initializeFunction = Object.keys(contractArtifacts.interface.functions).find((fname) =>
    fname.startsWith("initialize")
  );
  const encoded = utils.defaultAbiCoder.encode(
    contractArtifacts.interface.functions[initializeFunction].inputs,
    contractArgs
  );
  fs.writeFileSync(`artifacts/${proxyName}.address`, deployed.address);

  await updateDeployData(proxyName, contractName, deployed.address);

  console.log(" 📄", chalk.cyan(proxyName), "deployed to:", chalk.magenta(deployed.address));

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${proxyName}.args`, encoded.slice(2));

  return deployed;
};

// contract deploy
const deploy = async (contractName, _args = [], overrides = {}) => {
  if (!market) {
    throw("ERROR: market is not set, use setMarket()");
  }
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs = _args || [];
  const contractFactory = await ethers.getContractFactory(contractName);
  const deployed = await contractFactory.deploy(...contractArgs, overrides);
  const encoded = abiEncodeArgs(deployed, contractArgs);
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);

  await updateDeployData(contractName, contractName, deployed.address);

  console.log(" 📄", chalk.cyan(contractName), "deployed to:", chalk.magenta(deployed.address));

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${contractName}.args`, encoded.slice(2));

  return deployed;
};

const setMarket = (m) => {
  market = m;
}

module.exports = {
  deploy,
  deployProxy,
  setMarket,
};
