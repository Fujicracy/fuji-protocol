const fs = require("fs");
const chalk = require("chalk");
const bre = require("hardhat");

const publishDir = "../react-app/src/contracts";
const botsDir = "../bots/contracts";
const graphDir = "../subgraph"

function publishContract(contractName, dir) {
  console.log(
    "Publishing",
    chalk.cyan(contractName),
    "to",
    chalk.yellow(publishDir)
  );
  try {
    let contract;
    if (dir) {
      contract = fs
        .readFileSync(`${bre.config.paths.artifacts}/contracts/${dir}/${contractName}.sol/${contractName}.json`);
    }
    else {
      contract = fs
        .readFileSync(`${bre.config.paths.artifacts}/contracts/${contractName}.sol/${contractName}.json`);
    }
    const address = fs
      .readFileSync(`${bre.config.paths.artifacts}/${contractName}.address`)
      .toString();
    contract = JSON.parse(contract.toString());

    //let graphConfigPath = `${graphDir}/config/config.json`
    //let graphConfig
    //try {
      //if (fs.existsSync(graphConfigPath)) {
        //graphConfig = fs
          //.readFileSync(graphConfigPath)
          //.toString();
      //} else {
        //graphConfig = '{}'
      //}
      //} catch (e) {
        //console.log(e)
      //}

    //graphConfig = JSON.parse(graphConfig)
    //graphConfig[contractName + "Address"] = address

    fs.writeFileSync(
      `${publishDir}/${contractName}.address.js`,
      `module.exports = "${address}";`
    );
    fs.writeFileSync(
      `${publishDir}/${contractName}.abi.js`,
      `module.exports = ${JSON.stringify(contract.abi, null, 2)};`
    );
    fs.writeFileSync(
      `${publishDir}/${contractName}.bytecode.js`,
      `module.exports = "${contract.bytecode}";`
    );

    fs.writeFileSync(
      `${botsDir}/${contractName}.address.js`,
      `module.exports = "${address}";`
    );
    fs.writeFileSync(
      `${botsDir}/${contractName}.abi.js`,
      `module.exports = ${JSON.stringify(contract.abi, null, 2)};`
    );
    fs.writeFileSync(
      `${botsDir}/${contractName}.bytecode.js`,
      `module.exports = "${contract.bytecode}";`
    );

    //const folderPath = graphConfigPath.replace("/config.json","")
    //if (!fs.existsSync(folderPath)){
      //fs.mkdirSync(folderPath);
    //}
    //fs.writeFileSync(
      //graphConfigPath,
      //JSON.stringify(graphConfig, null, 2)
    //);
    //fs.writeFileSync(
      //`${graphDir}/abis/${contractName}.json`,
      //JSON.stringify(contract.abi, null, 2)
    //);

    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
}

function findMoreSolFiles(path) {
  const list = [];
  fs.readdirSync(path).forEach((file) => {
    if (file.indexOf(".sol") >= 0) {
      const contractName = file.replace(".sol", "");
      list.push(contractName);
    }
  });

  return list;
}

async function main() {
  if (!fs.existsSync(publishDir)) {
    fs.mkdirSync(publishDir);
  }

  const finalContractList = [];
  fs.readdirSync(bre.config.paths.sources).forEach((file) => {
    if (file.indexOf(".sol") >= 0) {
      const contractName = file.replace(".sol", "");
      if (publishContract(contractName)) {
        finalContractList.push(contractName);
      }
    }
    // if it's a directory
    else if (file.indexOf(".") === -1) {
      findMoreSolFiles(`${bre.config.paths.sources}/${file}`)
        .forEach((contractName) => {
          if (publishContract(contractName, file)) {
            finalContractList.push(contractName);
          }
        });
    }
  });
  console.log(finalContractList);
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
