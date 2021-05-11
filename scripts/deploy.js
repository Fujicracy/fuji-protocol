/* eslint no-use-before-define: "warn" */
const fs = require("fs");
const chalk = require("chalk");
const { config, ethers } = require("hardhat");
const { utils } = require("ethers");
const R = require("ramda");

const main = async () => {

  console.log("\n\n 📡 Deploying...\n");

  const DAI_ADDR = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  const UNISWAP_ROUTER_ADDR = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const CHAINLINK_ORACLE_ADDR = "0x773616E4d11A78F511299002da57A0a94577F1f4";

  const deployerWallet = ethers.provider.getSigner();

  // Step 1 of Deploy: Contracts which address is required to be hardcoded in other contracts
  //Fuji Mapping for Compound Contracts, for testing this is not required.
  //Fuji Mapping for CreamFinance Contracts
  const treasury = await deploy("GnosisSafe");

  // Step 2 Of Deploy: Functional Contracts
  const fujiadmin = await deploy("FujiAdmin");
  const fliquidator = await deploy("Fliquidator");
  const flasher = await deploy("Flasher");
  const controller = await deploy("Controller");
  const f1155 = await deploy("FujiERC1155");

  // Step 3 Of Deploy: Provider Contracts
  const aave = await deploy("ProviderAave");
  const compound = await deploy("ProviderCompound");
  const dydx = await deploy("ProviderDYDX");

  // Step 4 Of Deploy Core Money Handling Contracts
  const aWhitelist = await deploy("AlphaWhitelist", [
    "100",
    ethers.utils.parseEther("2")
  ]);
  const vaultharvester = await deploy("VaultHarvester");
  const vaultdai = await deploy("VaultETHDAI");
  const vaultusdc = await deploy("VaultETHUSDC");

  // Step 5 - General Plug-ins and Set-up Transactions
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury(treasury.address);
  await fujiadmin.setController(controller.address);
  await fujiadmin.setaWhitelist(aWhitelist.address);
  await fujiadmin.setVaultHarvester(vaultharvester.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setSwapper(UNISWAP_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(vaultdai.address, true);
  await f1155.setPermit(vaultusdc.address, true);
  await f1155.setPermit(fliquidator.address, true);

  // Step 6 - Vault Set-up
  await vaultdai.setFujiAdmin(fujiadmin.address)
  await vaultdai.setProviders([compound.address, aave.address, dydx.address]);
  await vaultdai.setActiveProvider(compound.address);
  await vaultdai.setFujiERC1155(f1155.address);
  await vaultdai.setOracle(CHAINLINK_ORACLE_ADDR);

  await vaultusdc.setFujiAdmin(fujiadmin.address);
  await vaultusdc.setProviders([compound.address, aave.address, dydx.address]);
  await vaultusdc.setActiveProvider(compound.address);
  await vaultusdc.setFujiERC1155(f1155.address);
  await vaultusdc.setOracle(CHAINLINK_ORACLE_ADDR);

  console.log(
    " 💾  Artifacts (address, abi, and args) saved to: ",
    chalk.blue("packages/hardhat/artifacts/"),
    "\n\n"
  );
};

const deploy = async (contractName, _args = [], overrides = {}) => {
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs = _args || [];
  const contractArtifacts = await ethers.getContractFactory(contractName);
  const deployed = await contractArtifacts.deploy(...contractArgs, overrides);
  const encoded = abiEncodeArgs(deployed, contractArgs);
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);

  console.log(
    " 📄",
    chalk.cyan(contractName),
    "deployed to:",
    chalk.magenta(deployed.address),
  );

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
  if (
    !contractArgs ||
    !deployed ||
    !R.hasPath(["interface", "deploy"], deployed)
  ) {
    return "";
  }
  const encoded = utils.defaultAbiCoder.encode(
    deployed.interface.deploy.inputs,
    contractArgs
  );
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
