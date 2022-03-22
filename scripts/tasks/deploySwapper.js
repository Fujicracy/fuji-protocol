const { deploy, redeployIf, network } = require("../utils");

const deploySwapper = async () => {
  let name;
  switch (network) {
    case "mainnet":
      name = "Swapper";
      break;
    case "fantom":
      name = "SwapperFTM";
      break;
    case "polygon":
      name = "SwapperMATIC";
      break;
    default:
      break;
  }

  let contractName;
  switch (network) {
    case "mainnet":
      contractName = "Swapper";
      break;
    case "fantom":
      contractName = "SwapperFTM";
      break;
    case "polygon":
      contractName = "SwapperMATIC";
      break;
    default:
      break;
  }

  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deploySwapper,
};
