const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const {
        getERC20Contract,
        findBootstrappingAssets,
        fixedFixture,
        evmSnapshot,
        evmRevert,
        ASSETS,
        Aave,
        Compound,
        Dydx,
        IronBank,
        Fuse3,
        Fuse18
      } = require("./multi-utils");

// *************************
//  TESTING PARAMETERS
// *************************

// Define here the vault-pairs ERC20 addresses to test, and txAmounts
// If more asset-ERC20-types are required, add them at multi-utils.js inside object ASSET

const testSetup = {
  pair1: {
    collateralAsset: ASSETS.ETH.address,
    borrowAsset: ASSETS.DAI.address,
    depositAmount: ethers.utils.parseUnits("10",18),
    borrowAmount: ethers.utils.parseUnits("500",18),
    withdrawAmount: ethers.utils.parseUnits("2",18),
    repayAmount: ethers.utils.parseUnits("200",18)
  },
  pair2: {
    collateralAsset: ASSETS.DAI.address,
    borrowAsset: ASSETS.ETH.address,
    depositAmount: ethers.utils.parseUnits("20000",18),
    borrowAmount: ethers.utils.parseUnits("2",18),
    withdrawAmount: ethers.utils.parseUnits("2000",18),
    repayAmount: ethers.utils.parseUnits("0.5",18)
  }
}


const pairsToTest =
    // Collateral, Borrow Asset
  [
      // Pair 1 => fujiTestVaults[0]
    ASSETS.DAI.address, ASSETS.ETH.address, // Pair 2 => fujiTestVaults[1]... etc
    ASSETS.ETH.address, ASSETS.USDC.address,
    ASSETS.USDC.address, ASSETS.ETH.address,
    ASSETS.ETH.address, ASSETS.ETH.address,
    ASSETS.WBTC.address, ASSETS.DAI.address,
    ASSETS.DAI.address, ASSETS.WBTC.address,
    ASSETS.WBTC.address, ASSETS.USDC.address,
    ASSETS.USDC.address, ASSETS.WBTC.address,
    ASSETS.WBTC.address, ASSETS.USDT.address,
    ASSETS.USDT.address, ASSETS.WBTC.address,
    ASSETS.WBTC.address, ASSETS.WBTC.address,
    ASSETS.ETH.address, ASSETS.WBTC.address,
    ASSETS.WBTC.address, ASSETS.ETH.address
  ]

//  Add the artifacts to array for providers to be tested
const providersArtifactToTest =
  [
    Compound,   // providersArtifactToTest[0] => fujiTestProviders[0]
    Fuse3,      // providersArtifactToTest[1] => fujiTestProviders[1]... etc
    Fuse18
  ]

// Define transaction Parameters
class theTXparameters  {
  depositUnit: 1,
  borrowUnit: 0.5,
  withdrawUnit: 0.25,
  repayUnit:
}

//*************************

const variableFixture = async ([wallet], pairsToTest, providersArtifactToTest, fujiadmin, oracle, f1155) => {

  // Deploy: Provider Contracts
  let fujiTestProviders = [];

  for (let i = 0; i < providersArtifactToTest.length; i++) {
    fujiTestProviders.push(await deployContract(wallet, providersArtifactToTest[i], []));
  }

  const FujiVault = await ethers.getContractFactory("FujiVault");

  let fujiTestVaults = [];

  // Deploy vault-pair proxies
  for (let i = 0; i < pairsToTest.length/2; i+2) {
    fujiTestVaults.push(
      await upgrades.deployProxy(FujiVault, [
        fujiadmin.address,
        oracle.address
        pairsToTest[i],
        pairsToTest[i+1],
      ]
    ));
  }

  // Set-up Plug-ins for all proxies inside fujiTestVaults
  for (let i = 0; i < fujiTestVaults.length; i++) {
    await f1155.setPermit(fujiTestVaults[i].address, true);
    await fujiTestVaults[i].setActiveProvider(fujiTestProviders[0].address);
    await fujiTestVaults[i].setFujiERC1155(f1155.address);
    await fujiadmin.addVault(fujiTestVaults[i].address);
  }

  return {
    fujiTestProviders,
    fujiTestVaults
  };
};


describe("Beta", () => {
  let fujiadmin;
  let oracle;
  let f1155;
  let fujiTestProviders;
  let fujiTestVaults;

  let users;

  let loadFixture;
  let evmSnapshotId;

  before(async () => {
    users = await ethers.getSigners();
    loadFixture = createFixtureLoader(users, ethers.provider);
    evmSnapshotId = await evmSnapshot();
  });

  after(async () => {
    evmRevert(evmSnapshotId);
  });

  beforeEach(async () => {
    const theFixFixture = await loadFixture(fixedFixture);
    fujiadmin = theFixFixture.fujiadmin;
    oracle = theFixFixture.oracle;
    f1155 = theFixFixture.f1155;

    const theVariableFixture = await loadFixture(
      variableFixture([],fujiadmin,oracle,f1155)
    );
    fujiTestProviders = theVariableFixture.fujiTestProviders;
    fujiTestVaults = theVariableFixture.fujiTestVaults;

  });

  describe("Multi-Vault Provider Functionality", () => {

    it("1.- Global Functional Test of multi Vaults and Providers ", async () => {

      // Bootstrap Liquidity in all proxy vaults
      const bootstrapUser = users[1];
      const bootAssets = await findBootstrappingAssets();
      const boostrapDepositAmount = ethers.utils.parseEther("3");


    });


    });
  });
});
