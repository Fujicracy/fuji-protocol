const fs = require("fs");
const hre = require("hardhat");

const publishDir = "../react-app/src/contracts";
const botsDir = "../bots/contracts";

async function main() {
  if (!fs.existsSync(publishDir)) {
    fs.mkdirSync(publishDir);
  }

  const finalContractList = [];

  const network = await hre.ethers.provider.getNetwork();
  const deployData = JSON.parse(
    fs.readFileSync(`${hre.config.paths.artifacts}/${network.chainId}.deploy`).toString()
  );

  // eslint-disable-next-line no-restricted-syntax
  for (const contractName of Object.keys(deployData)) {
    finalContractList.push(contractName);

    const info = deployData[contractName];

    fs.writeFileSync(
      `${publishDir}/${contractName}.address.js`,
      `module.exports = "${info.address}";`
    );
    fs.writeFileSync(
      `${publishDir}/${contractName}.abi.js`,
      `module.exports = ${JSON.stringify(info.abi, null, 2)};`
    );
    fs.writeFileSync(
      `${publishDir}/${contractName}.bytecode.js`,
      `module.exports = "${info.bytecode}";`
    );

    fs.writeFileSync(
      `${botsDir}/${contractName}.address.js`,
      `module.exports = "${info.address}";`
    );
    fs.writeFileSync(
      `${botsDir}/${contractName}.abi.js`,
      `module.exports = ${JSON.stringify(info.abi, null, 2)};`
    );
    fs.writeFileSync(
      `${botsDir}/${contractName}.bytecode.js`,
      `module.exports = "${info.bytecode}";`
    );
  }

  fs.writeFileSync(
    `${publishDir}/contracts.js`,
    `module.exports = ${JSON.stringify(finalContractList)};`
  );
  fs.writeFileSync(
    `${botsDir}/contracts.js`,
    `module.exports = ${JSON.stringify(finalContractList)};`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
