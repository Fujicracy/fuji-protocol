const { deploy, redeployIf, network } = require("../utils");

const deployFliquidator = async () => {
  let name;
  switch (network) {
    case "mainnet":
      name = "Fliquidator";
      break;
    case "fantom":
      name = "FliquidatorFTM";
      break;
    case "polygon":
      name = "FliquidatorMATIC";
      break;
    default:
      break;
  }

  let contractName;
  switch (network) {
    case "mainnet":
      contractName = "Fliquidator";
      break;
    case "fantom":
      contractName = "FliquidatorFTM";
      break;
    case "polygon":
      contractName = "FliquidatorMATIC";
      break;
    default:
      break;
  }

  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deployFliquidator,
};
