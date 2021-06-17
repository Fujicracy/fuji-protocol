const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { fixture, evmSnapshot, evmRevert } = require("./utils-alpha.js");

// use(solidity);

describe("Alpha", () => {
  let f1155;
  let compound;
  let vaultdai;
  let vaultusdc;

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
    const theFixture = await loadFixture(fixture);
    f1155 = theFixture.f1155;
    compound = theFixture.compound;
    vaultdai = theFixture.vaultdai;
    vaultusdc = theFixture.vaultusdc;

    await vaultdai.setActiveProvider(compound.address);
    await vaultusdc.setActiveProvider(compound.address);
  });

  describe("Alpha FujiERC1155 Functionality Test", () => {
    it("Users[1] Deposits 5 ETH, check that F1155 mints equivalent", async () => {
      const userX = users[1];
      const depositAmount = ethers.utils.parseEther("5");
      const negdepositAmount = ethers.utils.parseEther("-5");

      await expect(
        await vaultdai.connect(userX).deposit(depositAmount, { value: depositAmount })
      ).to.changeEtherBalance(userX, negdepositAmount);

      const vaultdaiAssetStruct = await vaultdai.connect(users[0]).vAssets();

      await expect(await f1155.balanceOf(userX.address, vaultdaiAssetStruct.collateralID)).to.equal(
        depositAmount
      );
    });
  });
});
