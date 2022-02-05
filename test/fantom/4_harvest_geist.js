const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { parseUnits, evmSnapshot, evmRevert, advanceBlocks, timeTravel, toBN } = require("../helpers");

const { fixture, ASSETS } = require("./utils");

const stakingContractABI = [
  {"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"withdrawableBalance","outputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"penaltyAmount","type":"uint256"}],"stateMutability":"view","type":"function"}
];

const gDAIAddr = '0x07E6332dD090D287d3489245038daF987955DCFB';
const gFTMAddr = '0x39b3bd37208cbade74d0fcbdbb12d606295b430a';
const gFUSDTAddr = '0x940f41f0ec9ba1a34cf001cc03347ac092f5f6b5';
const gUSDCAddr = '0xe578c856933d8e1082740bf7661e379aa2a30b26';
const gETHAddr = '0x25c130b2624cf12a4ea30143ef50c5d68cefa22f';
const gWBTCAddr = '0x38aca5484b8603373acc6961ecd57a6a594510a3';
//const gWFTMAddr = '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83';
const gCRVAddr = '0x690754a168b022331caa2467207c61919b3f8a98';
const gMIMAddr = '0xc664fc7b8487a3e10824cda768c1d239f2403bbe';
const gLINKAddr = '0xBeCF29265B0cc8D33fA24446599955C7bcF7F73B';

const variableDebtDAIAddr = '0xd25aa085EF6a304C6861750f16A3Fa0D03d25DDB';
const variableDebtETHAddr = '0xbdce00a99a4b7e99f7a6af7d44724f77d471f923';
const variableDebtFTMAddr = '0x53d01d351fa001db3c893388e43e3c630a8764f5';
const variableDebtWBTCAddr = '0x4318d7ad332a0fee9db6d2b9b4b021fda865abdb';
const variableDebtFUSDTAddr = '0x816ed5ee0c7b011024be3fb5b6166f59a7cbe0e4';
const variableDebtUSDCAddr = '0x3eef981640064d63bb7ead4c6e3c0457e5c2934d';
const variableDebtCRVAddr = '0x811a951d15f4dd33e9aa8d6f7aff6d1433fe644a';
const variableDebtMIMAddr = '0xe6f5b2d4de014d8fa4c45b744921ffdf13f15d4a';
const variableDebtLINKAddr = '0xfc8f690b285a013a86b7a71c0af70bc57302e7e4';

const allAssets = [
  gDAIAddr,
  gFTMAddr,
  gFUSDTAddr,
  gUSDCAddr,
  gETHAddr,
  gWBTCAddr,
  gCRVAddr,
  gMIMAddr,
  gLINKAddr,
  variableDebtDAIAddr,
  variableDebtETHAddr,
  variableDebtFTMAddr,
  variableDebtWBTCAddr,
  variableDebtFUSDTAddr,
  variableDebtUSDCAddr,
  variableDebtCRVAddr,
  variableDebtMIMAddr,
  variableDebtLINKAddr
];

const DEPOSIT_WBTC = 0.1;
const DEPOSIT_WETH = 1;

describe("Fantom Fuji Instance", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.deployer = this.users[0];
    this.user = this.users[2];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(fixture);
    this.evmSnapshot0 = await evmSnapshot();

    const block = await provider.getBlock();
    await this.f.swapper
      .connect(this.user)
      .swapETHForExactTokens(
        parseUnits(DEPOSIT_WETH),
        [ASSETS.WFTM.address, ASSETS.WETH.address],
        this.user.address,
        block.timestamp + 60,
        { value: parseUnits(2000) }
      );
    await this.f.swapper
      .connect(this.user)
      .swapETHForExactTokens(
        parseUnits(DEPOSIT_WBTC, 8),
        [ASSETS.WFTM.address, ASSETS.WBTC.address],
        this.user.address,
        block.timestamp + 60,
        { value: parseUnits(1500) }
      );
  });

  beforeEach(async function () {
    if (this.evmSnapshot1) await evmRevert(this.evmSnapshot1);

    this.evmSnapshot1 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("Harvesting in Geist Finance", function () {
    it("Should harvest gDAI in wethdai vault", async function () {
      const vault = this.f.vaultwethdai;
      const borrowAmount = parseUnits("2000");

      // set Geist as activeProvider
      await vault.setActiveProvider(this.f.geist.address);

      await this.f.weth
        .connect(this.user)
        .approve(vault.address, parseUnits(DEPOSIT_WETH));
      // Deposit and Borrow
      await vault
        .connect(this.user)
        .depositAndBorrow(parseUnits(DEPOSIT_WETH), borrowAmount);

      const vAssetStruct = await vault.vAssets();
      const collateralBalanceBefore = await this.f.f1155.balanceOf(
        this.user.address,
        vAssetStruct.collateralID
      );

      const farmProtocolNum = 0;
      const gDAI = await getContractAt("IERC20", gDAIAddr);

      // CLAIM
      await vault.connect(this.deployer).harvestRewards(
        farmProtocolNum,
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address[]"],
          [0, allAssets]
        )
      );

      // pass 7d
      await timeTravel(7 * 24 * 60 * 60);

      await expect(await gDAI.balanceOf(vault.address)).to.be.equal(toBN(0));
      // GET_REWARD
      await vault
        .connect(this.deployer)
        .harvestRewards(farmProtocolNum, ethers.utils.defaultAbiCoder.encode(["uint256"], [1]));

      // check gDAI balanceOf vault > 0
      await expect(await gDAI.balanceOf(vault.address)).to.be.gt(toBN(0));

      // WITHDRAW, SWAP and increase collateral
      await vault
        .connect(this.deployer)
        .harvestRewards(
          farmProtocolNum,
          ethers.utils.defaultAbiCoder.encode(["uint256", "address"], [2, ASSETS.DAI.address])
        );

      expect(await this.f.f1155.balanceOf(this.user.address, vAssetStruct.collateralID)).to.gt(
        collateralBalanceBefore
      );
    });

    it("Should harvest gDAI in wbtcdai vault", async function () {
      const vault = this.f.vaultwbtcdai;
      const borrowAmount = parseUnits("2000");

      // set Geist as activeProvider
      await vault.setActiveProvider(this.f.geist.address);

      await this.f.wbtc
        .connect(this.user)
        .approve(vault.address, parseUnits(DEPOSIT_WBTC, 8));
      // Deposit and Borrow
      await vault
        .connect(this.user)
        .depositAndBorrow(parseUnits(DEPOSIT_WBTC, 8), borrowAmount);

      const vAssetStruct = await vault.vAssets();
      const collateralBalanceBefore = await this.f.f1155.balanceOf(
        this.user.address,
        vAssetStruct.collateralID
      );

      const farmProtocolNum = 0;
      const gDAI = await getContractAt("IERC20", gDAIAddr);

      // CLAIM
      await vault.connect(this.deployer).harvestRewards(
        farmProtocolNum,
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address[]"],
          [0, allAssets]
        )
      );

      // pass 7d
      await timeTravel(7 * 24 * 60 * 60);

      await expect(await gDAI.balanceOf(vault.address)).to.be.equal(toBN(0));
      // GET_REWARD
      await vault
        .connect(this.deployer)
        .harvestRewards(farmProtocolNum, ethers.utils.defaultAbiCoder.encode(["uint256"], [1]));

      // check gDAI balanceOf vault > 0
      await expect(await gDAI.balanceOf(vault.address)).to.be.gt(toBN(0));

      // WITHDRAW, SWAP and increase collateral
      await vault
        .connect(this.deployer)
        .harvestRewards(
          farmProtocolNum,
          ethers.utils.defaultAbiCoder.encode(["uint256", "address"], [2, ASSETS.DAI.address])
        );

      expect(await this.f.f1155.balanceOf(this.user.address, vAssetStruct.collateralID)).to.gt(
        collateralBalanceBefore
      );
    });

    it("Should harvest gDAI in ftmdai vault", async function () {
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
      const gDAI = await getContractAt("IERC20", gDAIAddr);

      // CLAIM
      await vault.connect(this.deployer).harvestRewards(
        farmProtocolNum,
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address[]"],
          [0, allAssets]
        )
      );

      // pass 7d
      await timeTravel(7 * 24 * 60 * 60);

      await expect(await gDAI.balanceOf(vault.address)).to.be.equal(toBN(0));
      // GET_REWARD
      await vault
        .connect(this.deployer)
        .harvestRewards(farmProtocolNum, ethers.utils.defaultAbiCoder.encode(["uint256"], [1]));

      // check gDAI balanceOf vault > 0
      await expect(await gDAI.balanceOf(vault.address)).to.be.gt(toBN(0));

      // WITHDRAW, SWAP and increase collateral
      await vault
        .connect(this.deployer)
        .harvestRewards(
          farmProtocolNum,
          ethers.utils.defaultAbiCoder.encode(["uint256", "address"], [2, ASSETS.DAI.address])
        );

      //console.log(
      //collateralBalanceBefore.toString(),
      //(await this.f.f1155.balanceOf(this.user.address, vAssetStruct.collateralID)).toString()
      //);

      expect(await this.f.f1155.balanceOf(this.user.address, vAssetStruct.collateralID)).to.gt(
        collateralBalanceBefore
      );
    });

    it("Should harvest GEIST", async function () {
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
      const GEISTAddr = '0xd8321AA83Fb0a4ECd6348D4577431310A6E0814d';
      const GEIST = await getContractAt("IERC20", GEISTAddr);
      const stakingContract = await getContractAt(stakingContractABI, '0x49c93a95dbcc9a6a4d8f77e59c038ce5020e82f8');

      // CLAIM
      await vault.connect(this.deployer).harvestRewards(
        farmProtocolNum,
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "address[]"],
          [0, allAssets]
        )
      );

      // GET_REWARD
      await vault
        .connect(this.deployer)
        .harvestRewards(farmProtocolNum, ethers.utils.defaultAbiCoder.encode(["uint256"], [1]));

      // pass 3 months to unlock without penalty
      await timeTravel(90 * 24 * 60 * 60);

      // returns a tuple of withdrawable amount and a penalty
      const amount = await stakingContract.withdrawableBalance(vault.address);

      // WITHDRAW, SWAP and increase collateral
      await vault
        .connect(this.deployer)
        .harvestRewards(
          farmProtocolNum,
          ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [3, amount[0].toString()])
        );

      expect(await this.f.f1155.balanceOf(this.user.address, vAssetStruct.collateralID)).to.gt(
        collateralBalanceBefore
      );

    });

  });
});
