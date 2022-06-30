const { ethers, upgrades } = require("hardhat");

const { getContractAt, getContractFactory, provider } = ethers;

const { WrapperBuilder } = require("redstone-evm-connector");

const { LIB_PSEUDORANDOM } = require("../../utils");

const SPOOKY_ROUTER_ADDR = "0xF491e7B69E4244ad4002BC14e878a34207E38c29";
const TREASURY_ADDR = "0xb98d4D4e205afF4d4755E9Df19BD0B8BD4e0f148"; // Deployer

const DEBUG = false;

const ASSETS = {
  FTM: {
    name: "ftm",
    nameUp: "FTM",
    address: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF", // fantom
    oracle: "0xf4766552D15AE4d256Ad41B6cf2933482B0680dc",
    aToken: "0x39B3bd37208CBaDE74D0fcBDBb12D606295b430a",
    decimals: 18,
  },
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E", // fantom
    oracle: "0x91d5DEFAFfE2854C7D02F50c80FA1fdc8A721e52",
    aToken: "0x07E6332dD090D287d3489245038daF987955DCFB",
    decimals: 18,
  }
};

const {
  parseUnits
} = require("../../../helpers");

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

/**
 * Quick fixture provides a minimal testing setup for nft-game testing.
 * Only 'vaultftmdai' is available.
 * Only hundred provider is available.
 * Crate prices are artificially low.
 * Crate rewards are simplified.
 */
const quickFixture = async ([wallet]) => {
  // Step 0: Common
  const tokens = {};
  for (const asset in ASSETS) {
    tokens[`${ASSETS[asset].name}`] = await getContractAt("IERC20", ASSETS[asset].address);
  }
  const swapper = await getContractAt("IUniswapV2Router02", SPOOKY_ROUTER_ADDR);

  // Step 1: Base Contracts
  const FujiAdmin = await getContractFactory("FujiAdmin");
  const fujiadmin = await upgrades.deployProxy(FujiAdmin, []);

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
    }
  });
  const nftinteractions = await upgrades.deployProxy(
    NFTInteractions,
    [nftgame.address],
    {
      unsafeAllow: ['external-library-linking']
    }
  );

  const wrappednftinteractions = WrapperBuilder
    .wrapLite(nftinteractions)
    .usingPriceFeed("redstone", { asset: "ENTROPY" });

  await wrappednftinteractions.authorizeSignerEntropyFeed("0x0C39486f770B26F5527BBBf942726537986Cd7eb");

  // Step 2: Providers
  const ProviderHundred = await getContractFactory("ProviderHundred");
  const hundred = await ProviderHundred.deploy([]);

  // Log if debug is set true
  if (DEBUG) {
    console.log("fujiadmin", fujiadmin.address);
    console.log("f1155", f1155.address);
    console.log("oracle", oracle.address);
    console.log("nftgame", nftgame.address);
    console.log("nftinteractions", nftinteractions.address);
    console.log("hundred", hundred.address);
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
    await vault.setProviders(
      [
        hundred.address,
      ]
    );
    await vault.setActiveProvider(hundred.address);

    vaults[name] = vault;
  }

  // Step 4: General Setup
  await fujiadmin.setTreasury(TREASURY_ADDR);

  // Step 5: Specific Game Set-up
  await nftgame.grantRole(nftgame.GAME_ADMIN(), nftgame.signer.address);
  await nftgame.grantRole(nftgame.GAME_INTERACTOR(), nftinteractions.address);

  // Only one vault for quick testing
  await nftgame.setValidVaults([vaults['vaultftmdai'].address]);

  const now = (await provider.getBlock("latest")).timestamp;
  const week = 60 * 60 * 24 * 7;
  const gameTimestamps = [
    now + week,
    now + 2 * week,
    now + 3 * week,
    now + 4 *week
  ];

  await nftgame.setGamePhases(gameTimestamps);

  const crateIds = [
    await nftinteractions.CRATE_COMMON_ID(),
    await nftinteractions.CRATE_EPIC_ID(),
    await nftinteractions.CRATE_LEGENDARY_ID(),
  ];

  const pointsDecimals = await nftgame.POINTS_DECIMALS();

  // Simplified low crate prices just for testing
  const prices = [2, 4, 8].map((e) => parseUnits(e, pointsDecimals));

  for (let i = 0; i < prices.length; i++) {
    await nftinteractions.setCratePrice(crateIds[i], prices[i]);
  }

  // Simplified reward factors just for testing
  const rewardfactors = [
    [0, 0, 1, 2, 25],
    [0, 0, 1, 4, 50],
    [0, 0, 1, 8, 100],
  ];

  for (let i = 0; i < rewardfactors.length; i++) {
    await nftinteractions.setCrateRewards(
      crateIds[i],
      rewardfactors[i].map((e) => e * prices[i])
    );
  }

  const firstID = await nftinteractions.NFT_CARD_ID_START();
  const totalCards = await nftgame.nftCardsAmount();

  const cardIds = [
    firstID,
    firstID.add(totalCards).sub(1)
  ];

  return {
    ...tokens,
    ...vaults,
    hundred,
    nftgame,
    nftinteractions,
    oracle,
    fujiadmin,
    f1155,
    now,
    crateIds,
    cardIds
  };
};

module.exports = {
  quickFixture,
  ASSETS,
  VAULTS: getVaults(),
};
