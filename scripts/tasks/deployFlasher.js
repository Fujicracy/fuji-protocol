const { deploy, redeployIf, network } = require("../utils");

const deployFlasher = async () => {
  let name;
  switch (network) {
    case "mainnet":
      name = "Flasher";
      break;
    case "fantom":
      name = "FlasherFTM";
      break;
    case "polygon":
      name = "FlasherMATIC";
      break;
    default:
      break;
  }

  let contractName;
  switch (network) {
    case "mainnet":
      contractName = "Flasher";
      break;
    case "fantom":
      contractName = "FlasherFTM";
      break;
    case "polygon":
      contractName = "FlasherMATIC";
      break;
    default:
      break;
  }

  const deployed = await redeployIf(name, contractName, () => false, deploy);
  return deployed;
};

module.exports = {
  deployFlasher,
};
