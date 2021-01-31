/* eslint no-use-before-define: "warn" */
const fs = require("fs");
const chalk = require("chalk");
const { config, ethers } = require("hardhat");
const { utils } = require("ethers");
const R = require("ramda");

const main = async () => {

  console.log("\n\n 📡 Deploying...\n");

  const deployerWallet = ethers.provider.getSigner();
  const deployerAddress = await deployerWallet.getAddress();

  console.log(`This is the Owner Waller Address: ${deployerAddress}`);
  /* Add this wallet to your metamask to test.
  Account #0: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 (10000 ETH)
  Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
*/

  const libUniERC20 = await deploy("UniERC20");
  const flasher = await deploy("Flasher");
  const aave = await deploy("ProviderAave");
  const compound = await deploy("ProviderCompound");
  const controller = await deploy("Controller", [
    deployerAddress, //First Wallet address from forked network is the owner
    flasher.address, //flasher
    "20000000000000000000000000" //changeThreshold percentagedecimal to ray (0.02 x 10^27)
  ]);
  const vault = await deploy("VaultETHDAI", [
    controller.address,
    "0x773616E4d11A78F511299002da57A0a94577F1f4", // Oracle address
    deployerAddress, //First Wallet address from Scaffold forked network is the owner
  ]);

  //Set up the environment for testing Fuji contracts.
  await vault.addProvider(aave.address);
  await vault.addProvider(compound.address);
  await controller.addVault(vault.address);
  //await vault.depositAndBorrow("250000000000000000000", "500000000000000000000", {value: "250000000000000000000"});


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
