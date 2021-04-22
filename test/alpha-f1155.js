const { ethers } = require("hardhat");
const { expect } = require("chai");
const { solidity, createFixtureLoader } = require("ethereum-waffle");

const {
  fixture,
  convertToCurrencyDecimals,
  advanceblocks,
  convertToWei,
  evmSnapshot,
  evmRevert,
  DAI_ADDR,
  USDC_ADDR,
  ETH_ADDR,
  ONE_ETH
} = require("./utils-alpha.js");

//use(solidity);

describe("Alpha", () => {

  let dai;
  let usdc;
  let aweth;
  let ceth;
  let treasury;
  let fujiadmin;
  let fliquidator;
  let flasher;
  let controller;
  let f1155;
  let aave;
  let compound;
  let dydx;
  let aWhitelist;
  let vaultdai;
  let vaultusdc;

  let users;

  let loadFixture;
  let evmSnapshotId;

  before(async() => {
    users = await ethers.getSigners();
    loadFixture = createFixtureLoader(users, ethers.provider);
    evmSnapshotId = await evmSnapshot();

  });

  after(async() => {
    evmRevert(evmSnapshotId);

  });


    beforeEach(async() => {

      const _fixture = await loadFixture(fixture);
      dai = _fixture.dai;
      usdc = _fixture.usdc;
      aweth = _fixture.aweth;
      ceth = _fixture.ceth;
      treasury = _fixture.treasury;
      fujiadmin = _fixture.fujiadmin;
      fliquidator = _fixture.fliquidator;
      flasher = _fixture.flasher;
      controller = _fixture.controller;
      f1155 = _fixture.f1155;
      aave = _fixture.aave;
      compound = _fixture.compound;
      dydx = _fixture.dydx;
      aWhitelist = _fixture.aWhitelist;
      vaultdai = _fixture.vaultdai;
      vaultusdc = _fixture.vaultusdc;

      await vaultdai.setActiveProvider(compound.address);
      await vaultusdc.setActiveProvider(compound.address);



    });

    describe("Alpha FujiERC1155 Functionality Test", () => {

      it("Users[1] Deposits 5 ETH, check that F1155 mints equivalent", async () => {

        let user_X = users[1];
        let depositAmount = ethers.utils.parseEther("5");
        let negdepositAmount = ethers.utils.parseEther("-5");

        await expect(await vaultdai.connect(user_X)
              .deposit(depositAmount,
              { value: depositAmount })).to
              .changeEtherBalance(user_X, negdepositAmount);

        let vaultdaiAssetStruct = await vaultdai.connect(users[0]).vAssets();

        await expect(await f1155.balanceOf(user_X.address, vaultdaiAssetStruct.collateralID))
        .to.equal(depositAmount);

      });



    });
  });
