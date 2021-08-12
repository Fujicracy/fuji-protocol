const fs = require("fs");
const chalk = require("chalk");
const { ethers, upgrades, artifacts } = require("hardhat");
const { utils } = require("ethers");
const R = require("ramda");

let deployData;

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
  const contractArtifacts = await artifacts.readArtifact(contractName);

  deployData[name] = {
    address,
    abi: contractArtifacts.abi,
    bytecode: contractArtifacts.bytecode,
  };
};

// proxy deploy

const deployProxy = async (proxyName, contractName, _args = [], overrides = {}) => {
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

  updateDeployData(proxyName, contractName, deployed.address);

  console.log(" 📄", chalk.cyan(proxyName), "deployed to:", chalk.magenta(deployed.address));

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${proxyName}.args`, encoded.slice(2));

  return deployed;
};

// contract deploy

const deploy = async (contractName, _args = [], overrides = {}) => {
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs = _args || [];
  const contractFactory = await ethers.getContractFactory(contractName);
  const deployed = await contractFactory.deploy(...contractArgs, overrides);
  const encoded = abiEncodeArgs(deployed, contractArgs);
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);

  updateDeployData(contractName, contractName, deployed.address);

  console.log(" 📄", chalk.cyan(contractName), "deployed to:", chalk.magenta(deployed.address));

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${contractName}.args`, encoded.slice(2));

  return deployed;
};

const deployContracts = async () => {
  console.log("\n\n 📡 Deploying...\n");

  const UNISWAP_ROUTER_ADDR = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  const ASSETS = {
    DAI: {
      name: "dai",
      nameUp: "DAI",
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      oracle: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
    },
    USDC: {
      name: "usdc",
      nameUp: "USDC",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      oracle: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    },
    ETH: {
      name: "eth",
      nameUp: "ETH",
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      oracle: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    },
    FEI: {
      name: "fei",
      nameUp: "FEI",
      address: "0x956F47F50A910163D8BF957Cf5846D573E7f87CA",
      oracle: "0x31e0a88fecB6eC0a411DBe0e9E76391498296EE9",
    }
  };

  const deployerWallet = ethers.provider.getSigner();

  // Functional Contracts
  const fujiadmin = await deployProxy("FujiAdmin", "FujiAdmin");
  const fliquidator = await deploy("Fliquidator");
  const flasher = await deploy("Flasher");
  const controller = await deploy("Controller");
  const f1155 = await deploy("FujiERC1155");
  const oracle = await deploy("FujiOracle", [
    Object.values(ASSETS).map((asset) => asset.address),
    Object.values(ASSETS).map((asset) => asset.oracle),
  ]);

  // Provider Contracts
  const fuse3 = await deploy("ProviderFuse3");
  const fuse6 = await deploy("ProviderFuse6");
  const fuse7 = await deploy("ProviderFuse7");
  const fuse8 = await deploy("ProviderFuse8");
  const fuse18 = await deploy("ProviderFuse18");

  const vaultethfei = await deployProxy("VaultETHFEI", "FujiVault", [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.DAI.address,
  ]);
  const vaultethusdc = await deployProxy("VaultETHUSDC", "FujiVault", [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.USDC.address,
  ]);

  // General Plug-ins and Set-up Transactions
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury("0x9F5A10E45906Ef12497237cE10fB7AB9B850Ff86");
  await fujiadmin.setController(controller.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setFujiOracle(oracle.address);
  await fliquidator.setSwapper(UNISWAP_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(vaultethfei.address, true);
  await f1155.setPermit(vaultethusdc.address, true);

  // Vaults Set-up
  await vaultethfei.setProviders([fuse8.address]);
  await vaultethfei.setActiveProvider(fuse8.address);
  await vaultethfei.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultethfei.address, true);

  await vaultethusdc.setProviders([fuse7.address]);
  await vaultethusdc.setActiveProvider(fuse7.address);
  await vaultethusdc.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultethusdc.address, true);

  console.log(
    " 💾  Artifacts (address, abi, and args) saved to: ",
    chalk.blue("packages/hardhat/artifacts/"),
    "\n\n"
  );
};

const main = async () => {
  deployData = {};

  await deployContracts();

  const network = await ethers.provider.getNetwork();

  fs.writeFileSync(`artifacts/${network.chainId}.deploy`, JSON.stringify(deployData, null, 2));
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
