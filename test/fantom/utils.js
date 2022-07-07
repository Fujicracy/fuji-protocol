const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

const { getContractAt, getContractFactory } = ethers;

const { WrapperBuilder } = require("redstone-evm-connector");

const SPOOKY_ROUTER_ADDR = "0xF491e7B69E4244ad4002BC14e878a34207E38c29";
const TREASURY_ADDR = "0xb98d4D4e205afF4d4755E9Df19BD0B8BD4e0f148"; // Deployer

const LIB_PSEUDORANDOM = "0x4E2024595E04Fe0ed66f82552b1a2D057Bb11794"; //updated July 4, 2022

const DEBUG = false;

const ASSETS = {
  FTM: {
    name: "ftm",
    nameUp: "FTM",
    address: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF", // fantom
    oracle: "0xf4766552D15AE4d256Ad41B6cf2933482B0680dc",
    aToken: "0x39B3bd37208CBaDE74D0fcBDBb12D606295b430a",
    aTokenV3: "0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97",
    decimals: 18,
  },
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E", // fantom
    storageSlots: {
      balanceOf: 2,
    },
    oracle: "0x91d5DEFAFfE2854C7D02F50c80FA1fdc8A721e52",
    aToken: "0x07E6332dD090D287d3489245038daF987955DCFB",
    aTokenV3: "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
    decimals: 18,
  },
  USDC: {
    name: "usdc",
    nameUp: "USDC",
    address: "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75", // fantom
    storageSlots: {
      balanceOf: 2,
    },
    oracle: "0x2553f4eeb82d5A26427b8d1106C51499CBa5D99c",
    aToken: "0xe578C856933D8e1082740bf7661e379Aa2A30b26",
    aTokenV3: "0x625E7708f30cA75bfd92586e17077590C60eb4cD",
    decimals: 6,
  },
  WFTM: {
    name: "wftm",
    nameUp: "WFTM",
    address: "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83", // fantom
    storageSlots: {
      balanceOf: 0,
    },
    oracle: "0xf4766552D15AE4d256Ad41B6cf2933482B0680dc",
    aToken: "0x39B3bd37208CBaDE74D0fcBDBb12D606295b430a",
    aTokenV3: "0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97",
    decimals: 18,
  },
  WETH: {
    name: "weth",
    nameUp: "WETH",
    address: "0x74b23882a30290451A17c44f4F05243b6b58C76d", // fantom
    storageSlots: {
      balanceOf: 2,
    },
    oracle: "0x11DdD3d147E5b83D01cee7070027092397d63658",
    aToken: "0x25c130B2624CF12A4Ea30143eF50c5D68cEFA22f",
    aTokenV3: "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8",
    decimals: 18,
  },
  WBTC: {
    name: "wbtc",
    nameUp: "WBTC",
    address: "0x321162Cd933E2Be498Cd2267a90534A804051b11", // fantom
    storageSlots: {
      balanceOf: 2,
    },
    oracle: "0x8e94C22142F4A64b99022ccDd994f4e9EC86E4B4",
    aToken: "0x38aCa5484B8603373Acc6961Ecd57a6a594510A3",
    aTokenV3: "0x078f358208685046a11C85e8ad32895DED33A249",
    decimals: 8,
  },
};

// iterate through all ASSETS and create pairs
const getVaults = () => {
  const assets = Object.values(ASSETS);
  const vaults = [];
  assets.forEach((collateral, i1) => {
    assets.forEach((debt, i2) => {
      if (i1 !== i2) {
        vaults.push({
          name: `vault${collateral.name}${debt.name}`,
          collateral,
          debt,
        });
      }
    });
  });
  return vaults;
};

// console.log(getVaults());

const syncTime = async function () {
  const now = Math.ceil(new Date().getTime() / 1000);
  try {
    await ethers.provider.send("evm_setNextBlockTimestamp", [now]);
  } catch (error) {
    //Skipping time sync - block is ahead of current time
  }
};

const fixture = async ([wallet]) => {
  // Step 0: Common
  const tokens = {};
  for (const asset in ASSETS) {
    tokens[`${ASSETS[asset].name}`] = await getContractAt("IERC20", ASSETS[asset].address);
  }
  const swapper = await getContractAt("IUniswapV2Router02", SPOOKY_ROUTER_ADDR);
  const ftmWrapper = await getContractAt(
    "contracts/interfaces/IWETH.sol:IWETH",
    ASSETS.WFTM.address
  );

  // Step 1: Base Contracts
  const FujiAdmin = await getContractFactory("FujiAdmin");
  const fujiadmin = await upgrades.deployProxy(FujiAdmin, []);

  const Fliquidator = await getContractFactory("FliquidatorFTM");
  const fliquidator = await Fliquidator.deploy([]);

  const Flasher = await getContractFactory("FlasherFTM");
  const flasher = await Flasher.deploy([]);

  const Harvester = await getContractFactory("VaultHarvesterFTM");
  const harvester = await Harvester.deploy([]);

  const FujiSwapper = await getContractFactory("SwapperFTM");
  const fujiSwapper = await FujiSwapper.deploy([]);

  const Controller = await getContractFactory("Controller");
  const controller = await Controller.deploy([]);

  const F1155 = await getContractFactory("FujiERC1155");
  const f1155 = await upgrades.deployProxy(F1155, []);

  const FujiOracle = await getContractFactory("FujiOracle");
  const oracle = await FujiOracle.deploy(
    Object.values(ASSETS).map((asset) => asset.address),
    Object.values(ASSETS).map((asset) => asset.oracle)
  );

  const NFTGame = await getContractFactory("NFTGame");
  const nftgame = await upgrades.deployProxy(NFTGame, [[1, 2, 3, 4]]);

  const NFTInteractions = await getContractFactory("NFTInteractions", {
    libraries: {
      LibPseudoRandom: LIB_PSEUDORANDOM, // fantom
    },
  });
  const nftinteractions = await upgrades.deployProxy(NFTInteractions, [nftgame.address], {
    unsafeAllow: ["external-library-linking"],
  });

  const wrappednftinteractions = WrapperBuilder.wrapLite(nftinteractions).usingPriceFeed(
    "redstone",
    { asset: "ENTROPY" }
  );

  await wrappednftinteractions.authorizeSignerEntropyFeed(
    "0x0C39486f770B26F5527BBBf942726537986Cd7eb"
  );

  // Step 2: Providers
  const ProviderCream = await getContractFactory("ProviderCream");
  const cream = await ProviderCream.deploy([]);
  // const ProviderScream = await getContractFactory("ProviderScream");
  // const scream = await ProviderScream.deploy([]);
  const ProviderGeist = await getContractFactory("ProviderGeist");
  const geist = await ProviderGeist.deploy([]);
  const ProviderHundred = await getContractFactory("ProviderHundred");
  const hundred = await ProviderHundred.deploy([]);
  const ProviderAaveV3FTM = await getContractFactory("ProviderAaveV3FTM");
  const aaveV3 = await ProviderAaveV3FTM.deploy([]);

  // Log if debug is set true
  if (DEBUG) {
    console.log("fujiadmin", fujiadmin.address);
    console.log("fliquidator", fliquidator.address);
    console.log("flasher", flasher.address);
    console.log("controller", controller.address);
    console.log("f1155", f1155.address);
    console.log("oracle", oracle.address);
    console.log("nftgame", nftgame.address);
    console.log("nftinteractions", nftinteractions.address);
    console.log("cream", cream.address);
    console.log("scream", scream.address);
    console.log("geist", geist.address);
    console.log("hundred", hundred.address);
    console.log("aaveV3", aaveV3.address);
  }

  // Setp 3: Vaults
  const FujiVaultFTM = await getContractFactory("FujiVaultFTM");
  // deploy a vault for each entry in ASSETS
  const vaults = {};
  for (const { name, collateral, debt } of getVaults()) {
    const vault = await upgrades.deployProxy(FujiVaultFTM, [
      fujiadmin.address,
      oracle.address,
      collateral.address,
      debt.address,
    ]);

    if (DEBUG) {
      console.log(name, vault.address);
    }

    await f1155.setPermit(vault.address, true);
    await vault.setFujiERC1155(f1155.address);
    await vault.setNFTGame(nftgame.address);
    await fujiadmin.allowVault(vault.address, true);
    await vault.setProviders([cream.address, geist.address, hundred.address, aaveV3.address]);

    vaults[name] = vault;
  }

  // Step 4: Setup
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setSwapper(fujiSwapper.address);
  await fujiadmin.setVaultHarvester(harvester.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury(TREASURY_ADDR);
  await fujiadmin.setController(controller.address);
  await fliquidator.setFujiAdmin(fujiadmin.address);
  await fliquidator.setSwapper(SPOOKY_ROUTER_ADDR);
  await flasher.setFujiAdmin(fujiadmin.address);
  await controller.setFujiAdmin(fujiadmin.address);
  await f1155.setPermit(fliquidator.address, true);
  await nftgame.grantRole(nftgame.GAME_ADMIN(), nftgame.signer.address);
  await nftgame.grantRole(nftgame.GAME_INTERACTOR(), nftinteractions.address);

  return {
    ...tokens,
    ...vaults,
    cream,
    geist,
    hundred,
    aaveV3,
    nftgame,
    nftinteractions,
    oracle,
    fujiadmin,
    fliquidator,
    flasher,
    controller,
    f1155,
    swapper,
    ftmWrapper,
  };
};

const toBytes32 = (bn) => {
  return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
};

const setStorageAt = async (address, index, value) => {
  await ethers.provider.send("hardhat_setStorageAt", [address, index, value]);
  await ethers.provider.send("evm_mine", []); // Just mines to the next block
};

const getStorageSlot = (address, method) => {
  const assets = Object.values(ASSETS);
  const asset = assets.find((e) => e.address == address);
  const slot = asset.storageSlots[method];
  if (!slot) {
    throw "Set storage slot in 'ASSETS' object; Refer to https://github.com/kendricktan/slot20 on how get slot number.";
  }
  return asset.storageSlots[method];
};

/**
 * Sets ERC20 balance for testing purposes
 * @param {string} userAddr
 * @param {string} erc20address
 * @param {Object} BNbalance in ethers.BigNumber format
 */
const setERC20UserBalance = async (userAddr, erc20address, BNbalance) => {
  // Get storage slot index
  const slot = getStorageSlot(erc20address, "balanceOf");
  const solidityIndex = ethers.utils.solidityKeccak256(
    ["uint256", "uint256"],
    [userAddr, slot] // key, slot
  );
  // Manipulate local balance (needs to be bytes32 string)
  await setStorageAt(erc20address, solidityIndex.toString(), toBytes32(BNbalance).toString());
};

module.exports = {
  syncTime,
  fixture,
  setERC20UserBalance,
  ASSETS,
  VAULTS: getVaults(),
  LIB_PSEUDORANDOM,
};
