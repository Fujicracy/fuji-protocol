const { ethers } = require("hardhat");
const { deployProxy, deploy, redeployIf } = require("../utils");

const deployPreTokenBonds = async (args) => {
  const name = "PreTokenBonds";
  const contractName = "PreTokenBonds";
  const deployed = await redeployIf(name, contractName, deployProxy, args);
  const metadataContracts = await deployVoucherDescriptor(args, [...args, deployed]);
  const pretokenbonds = await ethers.getContractAt(contractName, deployed);
  const tx =  await pretokenbonds.setVoucherDescriptor(metadataContracts.descriptor);
  await tx.wait();
  return deployed;
};

/**
 * The voucher descriptor is a module smart contract to generate on-chain metadata in {PreTokenBonds.sol}
 */
const deployVoucherDescriptor = async (svgArgs, descriptorArgs) => {
  const svgName = "VoucherSVG";
  const svgContractName = "VoucherSVG";
  const svgDeployed = await redeployIf(svgName, svgContractName, deploy, svgArgs);

  const descriptorName = "VoucherDescriptor";
  const desprictorContractName = "VoucherDescriptor";
  const descriptorDeployed = await redeployIf(descriptorName, desprictorContractName, deploy, [...descriptorArgs, svgDeployed]);
  return {
    descriptor: descriptorDeployed,
    svg: svgDeployed
  };
};

module.exports = {
  deployPreTokenBonds,
};
