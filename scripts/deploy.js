/* eslint no-use-before-define: "warn" */
const fs = require("fs");
const chalk = require("chalk");
const { config, ethers, upgrades } = require("hardhat");
const { utils } = require("ethers");
const R = require("ramda");

const main = async () => {
  console.log("\n\n 📡 Deploying...\n");

  const UNISWAP_ROUTER_ADDR = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

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
  };

  const deployerWallet = ethers.provider.getSigner();

  // Step 1 of Deploy: Contracts which address is required to be hardcoded in other contracts
  // Fuji Mapping for Compound Contracts, for testing this is not required.
  // Fuji Mapping for CreamFinance Contracts
  // const treasury = await deploy("GnosisSafe");

  // Step 2 Of Deploy: Functional Contracts
  const fujiadmin = await deployFujiAdmin("FujiAdmin");
  const fliquidator = await deploy("Fliquidator");
  const flasher = await deploy("Flasher");
  const controller = await deploy("Controller");
  const f1155 = await deploy("FujiERC1155");
  const oracle = await deploy("FujiOracle", [
    Object.values(ASSETS).map((asset) => asset.address),
    Object.values(ASSETS).map((asset) => asset.oracle),
  ]);

  // Step 3 Of Deploy: Provider Contracts
  const aave = await deploy("ProviderAave");
  const compound = await deploy("ProviderCompound");
  const dydx = await deploy("ProviderDYDX");
  const ironBank = await deploy("ProviderIronBank");

  // Step 4 Of Deploy Core Money Handling Contracts
  const vaultharvester = await deploy("VaultHarvester");

  const vaultdai = await deployVault("VaultETHDAI", [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.DAI.address,
  ]);
  const vaultusdc = await deployVault("VaultETHUSDC", [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.USDC.address,
  ]);
  const vaultusdt = await deployVault("VaultETHUSDT", [
    fujiadmin.address,
    oracle.address,
    ASSETS.ETH.address,
    ASSETS.USDT.address,
  ]);

  // Step 5 - General Plug-ins and Set-up Transactions
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury("0x9F5A10E45906Ef12497237cE10fB7AB9B850Ff86");
  await fujiadmin.setController(controller.address);
  await fujiadmin.setVaultHarvester(vaultharvester.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setSwapper(UNISWAP_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(vaultdai.address, true);
  await f1155.setPermit(vaultusdc.address, true);
  await f1155.setPermit(vaultusdt.address, true);
  await f1155.setPermit(fliquidator.address, true);

  // Step 6 - Vault Set-up
  await vaultdai.setProviders([compound.address, aave.address, dydx.address, ironBank.address]);
  await vaultdai.setActiveProvider(compound.address);
  await vaultdai.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultdai.address, true);

  await vaultusdc.setProviders([compound.address, aave.address, dydx.address, ironBank.address]);
  await vaultusdc.setActiveProvider(compound.address);
  await vaultusdc.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultusdc.address, true);

  await vaultusdt.setProviders([compound.address, aave.address, ironBank.address]);
  await vaultusdt.setActiveProvider(compound.address);
  await vaultusdt.setFujiERC1155(f1155.address);
  await fujiadmin.allowVault(vaultusdt.address, true);

  console.log(
    " 💾  Artifacts (address, abi, and args) saved to: ",
    chalk.blue("packages/hardhat/artifacts/"),
    "\n\n"
  );
};

const deployFujiAdmin = async (contractName, _args = [], overrides = {}) => {
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs = _args || [];
  const FujiAdmin = await ethers.getContractFactory("FujiAdmin");
  const deployed = await upgrades.deployProxy(FujiAdmin, [...contractArgs]);
  const encoded = utils.defaultAbiCoder.encode(
    FujiAdmin.interface.functions["initialize()"].inputs,
    contractArgs
  );
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);

  console.log(" 📄", chalk.cyan(contractName), "deployed to:", chalk.magenta(deployed.address));

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${contractName}.args`, encoded.slice(2));

  return deployed;
};

const deployVault = async (contractName, _args = [], overrides = {}) => {
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs = _args || [];
  const FujiVault = await ethers.getContractFactory("FujiVault");
  const deployed = await upgrades.deployProxy(FujiVault, [...contractArgs]);
  const encoded = utils.defaultAbiCoder.encode(
    FujiVault.interface.functions["initialize(address,address,address,address)"].inputs,
    contractArgs
  );
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);

  console.log(" 📄", chalk.cyan(contractName), "deployed to:", chalk.magenta(deployed.address));

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${contractName}.args`, encoded.slice(2));

  return deployed;
};

const deploy = async (contractName, _args = [], overrides = {}) => {
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs = _args || [];
  const contractArtifacts = await ethers.getContractFactory(contractName);
  const deployed = await contractArtifacts.deploy(...contractArgs, overrides);
  const encoded = abiEncodeArgs(deployed, contractArgs);
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);

  console.log(" 📄", chalk.cyan(contractName), "deployed to:", chalk.magenta(deployed.address));

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${contractName}.args`, encoded.slice(2));

  return deployed;
};

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

// checks if it is a Solidity file
const isSolidity = (fileName) =>
  fileName.indexOf(".sol") >= 0 && fileName.indexOf(".swp") < 0 && fileName.indexOf(".swap") < 0;

const readArgsFile = (contractName) => {
  let args = [];
  try {
    const argsFile = `./contracts/${contractName}.args`;
    if (!fs.existsSync(argsFile)) return args;
    args = JSON.parse(fs.readFileSync(argsFile));
  } catch (e) {
    console.log(e);
  }
  return args;
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
