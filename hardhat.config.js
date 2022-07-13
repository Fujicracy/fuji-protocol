require("dotenv").config();
const { utils } = require("ethers");
const fs = require("fs");
const chalk = require("chalk");

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@tenderly/hardhat-tenderly");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("@openzeppelin/hardhat-defender");
require("@openzeppelin/hardhat-upgrades");

const { isAddress, getAddress, formatUnits, parseUnits } = utils;

if (!process.env.ALCHEMY_ID && !process.env.INFURA_ID) {
  throw "Please set ALCHEMY_ID or INFURA_ID in ./packages/hardhat/.env";
}
const mainnetUrl = process.env.ALCHEMY_ID
  ? `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_ID}`
  : `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`;

const network = process.env.NETWORK;
const forkUrl =
  network === "fantom"
    ? "https://rpc.ftm.tools/"
    : network === "bsc"
      ? "https://bsc-dataseed.binance.org/"
      : network === "polygon"
        ? `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ID}`
        : network === "arbitrum"
          ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ID}`
          : mainnetUrl

//
// Select the network you want to deploy to here:
//
const defaultNetwork = "localhost";

function mnemonic() {
  try {
    return fs.readFileSync("./mnemonic.txt").toString().trim();
  } catch (e) {
    if (defaultNetwork !== "localhost") {
      console.log(
        "☢️ WARNING: No mnemonic file created for a deploy account. Try `yarn run generate` and then `yarn run account`."
      );
    }
  }
  return "";
}

module.exports = {
  defaultNetwork,
  networks: {
    hardhat: {
      forking: {
        url: forkUrl,
        //blockNumber: 12962882, //before London
      },
    },
    localhost: {
      url: "http://localhost:8545",
      timeout: 200000,
      /*
        notice no mnemonic here? it will just use account 0 of the hardhat node to deploy
        (you can put in a mnemonic here to set the deployer locally)
      */
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : { mnemonic: mnemonic() },
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : { mnemonic: mnemonic() },
    },
    mainnet: {
      url: mainnetUrl,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : { mnemonic: mnemonic() },
    },
    fantom: {
      url: `https://rpc.ftm.tools/`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : { mnemonic: mnemonic() },
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : { mnemonic: mnemonic() },
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : { mnemonic: mnemonic() },
    },
    xdai: {
      url: "https://rpc.xdaichain.com/",
      gasPrice: 1000000000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : { mnemonic: mnemonic() },
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ID}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : { mnemonic: mnemonic() },
    },
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ID}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : { mnemonic: mnemonic() },
    },
  },
  etherscan: {
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    currency: "USD",
    // enabled: !!process.env.REPORT_GAS,
    gasPrice: 20,
    enabled: false,
  },
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 500,
          },
        },
      }
    ],
    overrides: {
      "contracts/fantom/nft-bonds/NFTInteractions.sol": {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: false
          },
        },
      },
      "contracts/fantom/nft-bonds/FujiPriceAware.sol": {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: false
          },
        },
      },
      "contracts/fantom/nft-bonds/mocks/MockRandomTests.sol": {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: false
          },
        },
      },
    },
  },
  mocha: {
    timeout: 200000,
  },
  defender: {
    apiKey: process.env.OZ_DEFENDER_API_KEY,
    apiSecret: process.env.OZ_DEFENDER_API_SECRET,
  }
};

const DEBUG = false;

function debug(text) {
  if (DEBUG) {
    console.log(text);
  }
}

/* eslint-disable */
function writeFiles(chainId, market, deployData) {
  fs.writeFileSync(
    `../bots/contracts/${chainId}-${market}.deployment.json`,
    JSON.stringify(deployData, null, 2)
  );
  fs.writeFileSync(
    `../react-app/src/contracts/${chainId}-${market}.deployment.json`,
    JSON.stringify(deployData, null, 2)
  );
}

task("publish", "Publish deployment data to other packages")
  .addOptionalParam("market", "Markets: fuse, core", "core")
  .setAction(async ({ market }, { ethers, config }) => {
    const network = await ethers.provider.getNetwork();

    const deployData = JSON.parse(
      fs.readFileSync(`${config.paths.artifacts}/${network.chainId}-${market}.deploy`).toString()
    );

    writeFiles(network.chainId, market, deployData);
  });

task("sync", "Sync mainnet deployment data to be used in current network")
  .addOptionalParam("cid", "ChainId: 1, 250", "1")
  .addOptionalParam("market", "Markets: fuse, core", "core")
  .setAction(async ({ cid, market }, { ethers, config }) => {
    const network = await ethers.provider.getNetwork();

    try {
      const deployDataCore = JSON.parse(
        fs.readFileSync(`${config.paths.artifacts}/${cid}-${market}.deploy`).toString()
      );
      writeFiles(network.chainId, market, deployDataCore);
      console.log(`${cid}-${market}.deploy: synced`);
    } catch (e) {
      console.log(`${cid}-${market}.deploy: not synced`);
    }
  });

task("wallet", "Create a wallet (pk) link", async (_, { ethers }) => {
  const randomWallet = ethers.Wallet.createRandom();
  const privateKey = randomWallet._signingKey().privateKey;
  console.log("🔐 WALLET Generated as " + randomWallet.address + "");
  console.log("🔗 http://localhost:3000/pk#" + privateKey);
});

task("fundedwallet", "Create a wallet (pk) link and fund it with deployer?")
  .addOptionalParam("amount", "Amount of ETH to send to wallet after generating")
  .addOptionalParam("url", "URL to add pk to")
  .setAction(async (taskArgs, { network, ethers }) => {
    const randomWallet = ethers.Wallet.createRandom();
    const privateKey = randomWallet._signingKey().privateKey;
    console.log("🔐 WALLET Generated as " + randomWallet.address + "");
    const url = taskArgs.url ? taskArgs.url : "http://localhost:3000";

    let localDeployerMnemonic;
    try {
      localDeployerMnemonic = fs.readFileSync("./mnemonic.txt");
      localDeployerMnemonic = localDeployerMnemonic.toString().trim();
    } catch (e) {
      /* do nothing - this file isn't always there */
    }

    const amount = taskArgs.amount ? taskArgs.amount : "0.01";
    const tx = {
      to: randomWallet.address,
      value: ethers.utils.parseEther(amount),
    };

    // SEND USING LOCAL DEPLOYER MNEMONIC IF THERE IS ONE
    // IF NOT SEND USING LOCAL HARDHAT NODE:
    if (localDeployerMnemonic) {
      let deployerWallet = new ethers.Wallet.fromMnemonic(localDeployerMnemonic);
      deployerWallet = deployerWallet.connect(ethers.provider);
      console.log(
        "💵 Sending " + amount + " ETH to " + randomWallet.address + " using deployer account"
      );
      const sendresult = await deployerWallet.sendTransaction(tx);
      console.log("\n" + url + "/pk#" + privateKey + "\n");
    } else {
      console.log("💵 Sending " + amount + " ETH to " + randomWallet.address + " using local node");
      console.log("\n" + url + "/pk#" + privateKey + "\n");
      return send(ethers.provider.getSigner(), tx);
    }
  });

task("generate", "Create a mnemonic for builder deploys", async (_, { ethers }) => {
  const bip39 = require("bip39");
  const hdkey = require("ethereumjs-wallet/hdkey");
  const mnemonic = bip39.generateMnemonic();
  if (DEBUG) console.log("mnemonic", mnemonic);
  const seed = await bip39.mnemonicToSeed(mnemonic);
  if (DEBUG) console.log("seed", seed);
  const hdwallet = hdkey.fromMasterSeed(seed);
  const wallet_hdpath = "m/44'/60'/0'/0/";
  const account_index = 0;
  const fullPath = wallet_hdpath + account_index;
  if (DEBUG) console.log("fullPath", fullPath);
  const wallet = hdwallet.derivePath(fullPath).getWallet();
  const privateKey = "0x" + wallet._privKey.toString("hex");
  if (DEBUG) console.log("privateKey", privateKey);
  const EthUtil = require("ethereumjs-util");
  const address = "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");
  console.log("🔐 Account Generated as " + address + " and set as mnemonic in packages/hardhat");
  console.log("💬 Use 'yarn run account' to get more information about the deployment account.");

  fs.writeFileSync("./" + address + ".txt", mnemonic.toString());
  fs.writeFileSync("./mnemonic.txt", mnemonic.toString());
});

task("mine", "Looks for a deployer account that will give leading zeros")
  .addParam("searchFor", "String to search for")
  .setAction(async (taskArgs, { network, ethers }) => {
    let contract_address = "";
    let address;

    const bip39 = require("bip39");
    const hdkey = require("ethereumjs-wallet/hdkey");

    let mnemonic = "";
    while (contract_address.indexOf(taskArgs.searchFor) != 0) {
      mnemonic = bip39.generateMnemonic();
      if (DEBUG) console.log("mnemonic", mnemonic);
      const seed = await bip39.mnemonicToSeed(mnemonic);
      if (DEBUG) console.log("seed", seed);
      const hdwallet = hdkey.fromMasterSeed(seed);
      const wallet_hdpath = "m/44'/60'/0'/0/";
      const account_index = 0;
      const fullPath = wallet_hdpath + account_index;
      if (DEBUG) console.log("fullPath", fullPath);
      const wallet = hdwallet.derivePath(fullPath).getWallet();
      const privateKey = "0x" + wallet._privKey.toString("hex");
      if (DEBUG) console.log("privateKey", privateKey);
      const EthUtil = require("ethereumjs-util");
      address = "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");

      const rlp = require("rlp");
      const keccak = require("keccak");

      const nonce = 0x00; // The nonce must be a hex literal!
      const sender = address;

      const input_arr = [sender, nonce];
      const rlp_encoded = rlp.encode(input_arr);

      const contract_address_long = keccak("keccak256").update(rlp_encoded).digest("hex");

      contract_address = contract_address_long.substring(24); // Trim the first 24 characters.
    }

    console.log("⛏  Account Mined as " + address + " and set as mnemonic in packages/hardhat");
    console.log(
      "📜 This will create the first contract: " + chalk.magenta("0x" + contract_address)
    );
    console.log("💬 Use 'yarn run account' to get more information about the deployment account.");

    fs.writeFileSync("./" + address + "_produces" + contract_address + ".txt", mnemonic.toString());
    fs.writeFileSync("./mnemonic.txt", mnemonic.toString());
  });

task("account", "Get balance informations for the deployment account.", async (_, { ethers }) => {
  const hdkey = require("ethereumjs-wallet/hdkey");
  const bip39 = require("bip39");
  const mnemonic = fs.readFileSync("./mnemonic.txt").toString().trim();
  if (DEBUG) console.log("mnemonic", mnemonic);
  const seed = await bip39.mnemonicToSeed(mnemonic);
  if (DEBUG) console.log("seed", seed);
  const hdwallet = hdkey.fromMasterSeed(seed);
  const wallet_hdpath = "m/44'/60'/0'/0/";
  const account_index = 0;
  const fullPath = wallet_hdpath + account_index;
  if (DEBUG) console.log("fullPath", fullPath);
  const wallet = hdwallet.derivePath(fullPath).getWallet();
  const privateKey = "0x" + wallet._privKey.toString("hex");
  if (DEBUG) console.log("privateKey", privateKey);
  const EthUtil = require("ethereumjs-util");
  const address = "0x" + EthUtil.privateToAddress(wallet._privKey).toString("hex");

  const qrcode = require("qrcode-terminal");
  qrcode.generate(address);
  console.log("‍📬 Deployer Account is " + address);
  for (const n in config.networks) {
    // console.log(config.networks[n],n)
    try {
      const provider = new ethers.providers.JsonRpcProvider(config.networks[n].url);
      const balance = await provider.getBalance(address);
      console.log(" -- " + n + " --  -- -- 📡 ");
      console.log("   balance: " + ethers.utils.formatEther(balance));
      console.log("   nonce: " + (await provider.getTransactionCount(address)));
    } catch (e) {
      if (DEBUG) {
        console.log(e);
      }
    }
  }
});

async function addr(ethers, addr) {
  if (isAddress(addr)) {
    return getAddress(addr);
  }
  const accounts = await ethers.provider.listAccounts();
  if (accounts[addr] !== undefined) {
    return accounts[addr];
  }
  throw `Could not normalize address: ${addr}`;
}

task("accounts", "Prints the list of accounts", async (_, { ethers }) => {
  const accounts = await ethers.provider.listAccounts();
  accounts.forEach((account) => console.log(account));
});

task("blockNumber", "Prints the block number", async (_, { ethers }) => {
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log(blockNumber);
});

task("balance", "Prints an account's balance")
  .addPositionalParam("account", "The account's address")
  .setAction(async (taskArgs, { ethers }) => {
    const balance = await ethers.provider.getBalance(await addr(ethers, taskArgs.account));
    console.log(formatUnits(balance, "ether"), "ETH");
  });

function send(signer, txparams) {
  return signer.sendTransaction(txparams, (error, transactionHash) => {
    if (error) {
      debug(`Error: ${error}`);
    }
    debug(`transactionHash: ${transactionHash}`);
    // checkForReceipt(2, params, transactionHash, resolve)
  });
}

task("send", "Send ETH")
  .addParam("from", "From address or account index")
  .addOptionalParam("to", "To address or account index")
  .addOptionalParam("amount", "Amount to send in ether")
  .addOptionalParam("data", "Data included in transaction")
  .addOptionalParam("gasPrice", "Price you are willing to pay in gwei")
  .addOptionalParam("gasLimit", "Limit of how much gas to spend")

  .setAction(async (taskArgs, { network, ethers }) => {
    const from = await addr(ethers, taskArgs.from);
    debug(`Normalized from address: ${from}`);
    const fromSigner = await ethers.provider.getSigner(from);

    let to;
    if (taskArgs.to) {
      to = await addr(ethers, taskArgs.to);
      debug(`Normalized to address: ${to}`);
    }

    const txRequest = {
      from: await fromSigner.getAddress(),
      to,
      value: parseUnits(taskArgs.amount ? taskArgs.amount : "0", "ether").toHexString(),
      nonce: await fromSigner.getTransactionCount(),
      gasLimit: taskArgs.gasLimit ? taskArgs.gasLimit : 24000,
      chainId: network.config.chainId,
    };

    if (taskArgs.data !== undefined) {
      txRequest.data = taskArgs.data;
      debug(`Adding data to payload: ${txRequest.data}`);
    }
    debug(txRequest.gasPrice / 1000000000 + " gwei");
    debug(JSON.stringify(txRequest, null, 2));

    return send(fromSigner, txRequest);
  });
/* eslint-disable */
