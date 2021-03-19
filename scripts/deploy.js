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

  const fliquidator = await deploy("Fliquidator", [UNISWAP_ROUTER_ADDR]);
  const flasher = await deploy("Flasher");
  const controller = await deploy("Controller", [flasher.address, fliquidator.address, "10000000000000000000000000"]);
  const aave = await deploy("ProviderAave");
  const compound = await deploy("ProviderCompound");
  const dydx = await deploy("ProviderDYDX");
  const vault = await deploy("VaultETHDAI", [controller.address,fliquidator.address,CHAINLINK_ORACLE_ADDR]);
  const debtToken = await deploy("DebtToken", [vault.address, DAI_ADDR,"Fuji DAI debt token","fjDAI"]);

  //Set up the environment
  await flasher.setController(controller.address);
  await flasher.setVaultAuthorization(vault.address, true);
  await vault.setDebtToken(debtToken.address);
  await vault.setFlasher(flasher.address);
  await vault.addProvider(compound.address);
  await vault.addProvider(aave.address);
  await vault.addProvider(dydx.address);
  await controller.addVault(vault.address);

  //Some tasks
  for (var i = 0; i < 50; i++) {
    await ethers.provider.send("evm_mine");
  }
  await vault.addmetowhitelist(); //DeployerWallet gets Whitelisted

  // const exampleToken = await deploy("ExampleToken")
  // const examplePriceOracle = await deploy("ExamplePriceOracle")
  // const smartContractWallet = await deploy("SmartContractWallet",[exampleToken.address,examplePriceOracle.address])

  /*

  //If you want to send some ETH to a contract on deploy (make your constructor payable!)

  const yourContract = await deploy("YourContract", [], {
  value: ethers.utils.parseEther("0.05")
  });
  */



  /*
  //If you want to send value to an address from the deployer
  await deployerWallet.sendTransaction({
    to: "",
    value: ethers.utils.parseEther("10")
  })*/



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
