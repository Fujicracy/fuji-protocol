const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, advanceBlocks, timeTravel, toBN } = require("../helpers");

const { fixture, ASSETS } = require("./utils");

describe("Fantom Fuji Instance", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.deployer = this.users[0];
    this.user = this.users[2];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(fixture);
    this.evmSnapshot0 = await evmSnapshot();
  });

  beforeEach(async function () {
    if (this.evmSnapshot1) await evmRevert(this.evmSnapshot1);

    this.evmSnapshot1 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("Harvesting in Geist Finance", function () {
    //it("Should harvest COMP", async function () {
    //});

    it("Should harvest gDAI", async function () {
      // Set up variables
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits("3000");
      const borrowAmount = parseUnits("2000");

      // set Geist as activeProvider
      await vault.setActiveProvider(this.f.geist.address);

      // Deposit and Borrow
      await vault
        .connect(this.user)
        .depositAndBorrow(depositAmount, borrowAmount, { value: depositAmount });

      const vAssetStruct = await vault.vAssets();
      const collateralBalanceBefore = await this.f.f1155.balanceOf(
        this.user.address,
        vAssetStruct.collateralID
      );

      const farmProtocolNum = 0;
      const gDAIAddress = '0x07E6332dD090D287d3489245038daF987955DCFB';
      const gDAI = await getContractAt("IERC20", gDAIAddress);

      // CLAIM
      await vault.connect(this.deployer).harvestRewards(
        farmProtocolNum,
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address[]"],
          [
            0,
            [
              gDAIAddress,
              '0xd25aa085EF6a304C6861750f16A3Fa0D03d25DDB', // variableDebtDAI
            ],
          ]
        )
      );

      // pass 60s
      await timeTravel(60);

      await expect(await gDAI.balanceOf(vault.address)).to.be.equal(toBN(0));
      // GET_REWARD
      await vault
        .connect(this.deployer)
        .harvestRewards(farmProtocolNum, ethers.utils.defaultAbiCoder.encode(["uint256"], [1]));

      // check gDAI balanceOf vault > 0
      await expect(await gDAI.balanceOf(vault.address)).to.be.gt(toBN(0));

      //await timeTravel(864000 + 86400); // pass 11 days

      // WITHDRAW, SWAP and increase collateral
      await vault
        .connect(this.deployer)
        .harvestRewards(
          farmProtocolNum,
          ethers.utils.defaultAbiCoder.encode(["uint256", "address"], [2, ASSETS.DAI.address])
        );

      console.log(
        collateralBalanceBefore.toString(),
        (await this.f.f1155.balanceOf(this.user.address, vAssetStruct.collateralID)).toString()
      );

      expect(await this.f.f1155.balanceOf(this.user.address, vAssetStruct.collateralID)).to.gt(
        collateralBalanceBefore
      );
    });
  });
});
