const { ethers, upgrades } = require("hardhat");

const { getContractFactory, provider } = ethers;

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

/**
 * Bond fixture provides a minimal testing setup for nft-game testing in bonding phase.
 * Only 'vaultftmdai' is available.
 * Only scream provider is available.
 * Crate prices are artificially low.
 * Crate rewards are simplified.
 */
const bondFixture = async ([wallet]) => {
  
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
  const ProviderScream = await getContractFactory("ProviderScream");
  const scream = await ProviderScream.deploy([]);

  // Log if debug is set true
  if (DEBUG) {
    console.log("fujiadmin", fujiadmin.address);
    console.log("f1155", f1155.address);
    console.log("oracle", oracle.address);
    console.log("nftgame", nftgame.address);
    console.log("nftinteractions", nftinteractions.address);
    console.log("scream", scream.address);
  }

  // Step 3: Deploy vaults
  const FujiVaultFTM = await getContractFactory("FujiVaultFTM");
  // deploy a vault for each entry in ASSETS
  const vault = await upgrades.deployProxy(FujiVaultFTM, [
    fujiadmin.address,
    oracle.address,
    ASSETS.FTM.address,
    ASSETS.DAI.address
  ]);

  // Step 3.1: Setup vault 
  await f1155.setPermit(vault.address, true);
  await vault.setFujiERC1155(f1155.address);
  await vault.setNFTGame(nftgame.address);
  await fujiadmin.allowVault(vault.address, true);
  await vault.setProviders(
    [
      scream.address,
    ]
  );
  await vault.setActiveProvider(scream.address);

  // Step 4: General Setup
  await fujiadmin.setTreasury(TREASURY_ADDR);

  // Step 5: Specific Game Set-up
  await nftgame.grantRole(nftgame.GAME_ADMIN(), nftgame.signer.address);
  await nftgame.grantRole(nftgame.GAME_INTERACTOR(), nftinteractions.address);
  
  // Only one vault for quick testing
  await nftgame.setValidVaults([vault.address]);

  const now = (await provider.getBlock("latest")).timestamp;
  const day = 60 * 60 * 24;

  // Refer to NFTGame.sol for timestamp descriptions.
  const gameTimestamps = [
    now,            
    now + day,      
    now + 2 * day,
    now + 3 * day
  ];
  
  await nftgame.setGamePhases(gameTimestamps);

  const crateIds = [
    await nftinteractions.CRATE_COMMON_ID(),
    await nftinteractions.CRATE_EPIC_ID(),
    await nftinteractions.CRATE_LEGENDARY_ID(),
  ];

  const pointsDecimals = await nftgame.POINTS_DECIMALS();

  // Low crate prices just for testing only
  const prices = [2, 4, 8].map((e) => parseUnits(e, pointsDecimals));

  for (let i = 0; i < prices.length; i++) {
    await nftinteractions.setCratePrice(crateIds[i], prices[i]);
  }

  // Reward factors just for testing only
  const rewardfactors = [
    [0, 1, 2, 25, 50],
    [0, 1, 4, 50, 100],
    [0, 1, 8, 200, 1000]
  ];

  for (let i = 0; i < rewardfactors.length; i++) {
    await nftinteractions.setCrateRewards(
      crateIds[i],
      rewardfactors[i].map((e) => e * prices[i])
    );
  }

  const firstID = await nftinteractions.NFT_CARD_ID_START();
  const totalCards = await nftgame.nftCardsAmount();

  let lastId = firstID.add(totalCards).sub(1);

  const cardIds = [
    firstID,
    lastId
  ];

  // Set Cardboosts
  for (let index = firstID; index <= lastId.toNumber() / 1; index++) {
    await nftinteractions.setCardBoost(firstID, 110);
  }

  // Delayed entropy feed check to allowing time travel; for testing only
  await nftinteractions.setMaxEntropyDelay(60 * 60 * 24 * 365 * 2);

  /**
   * Step 6
   * Pretokenbond contract deploy and setup
   * 
   */

  const PreTokenBond = await getContractFactory("PreTokenBonds");
  const pretokenbond = await upgrades.deployProxy(PreTokenBond,
    [
      nftgame.address
    ]
  );

  // Set pretokenbond contract in nftinteractions
  await nftinteractions.setPreTokenBonds(pretokenbond.address);

  // Deploy of mock tocken to be used in bond testing.
  const MockToken = await getContractFactory("MockToken");
  const proxyOpts = {
    kind: 'uups'
  };
  const mocktoken = await upgrades.deployProxy(MockToken, [], proxyOpts);

  // Set underlying in pretokenbond contract
  await pretokenbond.setUnderlying(mocktoken.address);

  // Override for testing only: change to low bond price
  await pretokenbond.setBondPrice(parseUnits(1, pointsDecimals));

  /**
   * Step 7
   * Deploy metadata and svg generation contracts and setup
   * 
   */
  const VoucherDescriptor = await getContractFactory("VoucherDescriptor");
  const VoucherSVG = await getContractFactory("VoucherSVG");
  const LockNFTDescriptor = await getContractFactory("LockNFTDescriptor");
  const LockSVG = await getContractFactory("LockSVG");

  const vsvg = await VoucherSVG.deploy(nftgame.address);
  const vdescriptor = await VoucherDescriptor.deploy(
    nftgame.address,
    pretokenbond.address,
    vsvg.address
  );

  const lsvg = await upgrades.deployProxy(LockSVG, [nftgame.address], proxyOpts);
  const ldescriptor = await LockNFTDescriptor.deploy(
    nftgame.address,
    lsvg.address
  );

  // Metadata and svg generation setup
  await nftgame.setLockNFTDescriptor(ldescriptor.address);
  await pretokenbond.setVoucherDescriptor(vdescriptor.address);

  return {
    vault,
    scream,
    nftgame,
    nftinteractions,
    pretokenbond,
    mocktoken,
    oracle,
    fujiadmin,
    f1155,
    vdescriptor,
    vsvg,
    ldescriptor,
    lsvg,
    pointsDecimals,
    now,
    day,
    crateIds,
    cardIds,
    gameTimestamps
  };
};

module.exports = {
  bondFixture
};
