const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");

const decimals = 18;

describe("Simple Staking Test", () => {
  let stakeToken, rewardToken, simpleStaking;
  let owner, test1, test2, ownerAdd;

  before(async () => {
    upgrades.silenceWarnings();

    [owner, test1, test2] = await ethers.getSigners();

    const StakeToken = await ethers.getContractFactory("StakeToken");
    stakeToken = await upgrades.deployProxy(StakeToken, []);
    await stakeToken.deployed();
    console.log("Stake token address: " + stakeToken.address);

    const RewardToken = await ethers.getContractFactory("RewardToken");
    rewardToken = await upgrades.deployProxy(RewardToken, []);
    await rewardToken.deployed();
    console.log("Reward token address: " + rewardToken.address);

    const SimpleStaking = await ethers.getContractFactory("SimpleStaking");
    simpleStaking = await upgrades.deployProxy(SimpleStaking, [rewardToken.address]);

    await simpleStaking.deployed();
    console.log("simple staking address: " + simpleStaking.address);

    await simpleStaking.transferOwnership(owner.address);
    // console.log(deployedAdmin, 'ccccccccccccc');
    // await upgrades['admin'].changeProxyAdmin(deployedAdmin, owner.address);

    // send reward token to test account
    await stakeToken.transfer(test1.address, ethers.utils.parseUnits("10000.0", decimals));
    await stakeToken.transfer(test2.address, ethers.utils.parseUnits("10000.0", decimals));

    // send reward token to staking contract
    await rewardToken.transfer(simpleStaking.address, ethers.utils.parseUnits("90000.0", decimals));
  });

  it("stake function", async () => {
    await stakeToken
      .connect(test1)
      .approve(simpleStaking.address, ethers.utils.parseUnits("1000.0", decimals));

    // zero staking will occur error
    await expect(
      simpleStaking
        .connect(test1)
        .stake(stakeToken.address, ethers.utils.parseUnits("0.0", decimals))
    ).to.be.revertedWith("Cannot stake nothing");

    await simpleStaking
      .connect(test1)
      .stake(stakeToken.address, ethers.utils.parseUnits("1000.0", decimals));
    const balanceData = await stakeToken.balanceOf(test1.address);
    expect(ethers.utils.formatUnits(balanceData._hex, decimals).toString()).to.equal("9000.0");

    await stakeToken
      .connect(test1)
      .approve(simpleStaking.address, ethers.utils.parseUnits("1000.0", decimals));
    await expect(
      simpleStaking
        .connect(test1)
        .stake(stakeToken.address, ethers.utils.parseUnits("1000.0", decimals))
    ).to.be.revertedWith("Reward rate not exist");
  });

  it("setRewardRate function", async () => {
    await expect(
      simpleStaking
        .connect(owner)
        .setRewardRate(stakeToken.address, ethers.utils.parseUnits("0.0", 0))
    ).to.be.revertedWith("Reward rate should be bigger than zero");

    await simpleStaking
      .connect(owner)
      .setRewardRate(stakeToken.address, ethers.utils.parseUnits("20.0", 0));
  });

  it("unstake function", async () => {
    await expect(
      simpleStaking
        .connect(test1)
        .unstake(stakeToken.address, ethers.utils.parseUnits("0.0", decimals))
    ).to.be.revertedWith("Cannot unstake nothing");

    await expect(
      simpleStaking
        .connect(test1)
        .unstake(test2.address, ethers.utils.parseUnits("1000.0", decimals))
    ).to.be.revertedWith("You didnt stake this token");

    await expect(
      simpleStaking
        .connect(test1)
        .unstake(stakeToken.address, ethers.utils.parseUnits("1000.0", decimals))
    ).to.be.revertedWith("Can not unstake over staked amount");

    // await expect(
    await simpleStaking
      .connect(test1)
      .unstake(stakeToken.address, ethers.utils.parseUnits("500.0", decimals));
    // ).to.emit(simpleStaking, "Unstake")
    // .withArgs(test1.address, stakeToken.address, stakeToken.address, 0, );
  });

  it("withdrawUnstaked function", async () => {
    await expect(
      simpleStaking
        .connect(test1)
        .withdrawUnstaked(stakeToken.address, ethers.utils.parseUnits("0.0", decimals))
    ).to.be.revertedWith("Can not withdraw nothing");

    await expect(
      simpleStaking
        .connect(test1)
        .withdrawUnstaked(test2.address, ethers.utils.parseUnits("1000.0", decimals))
    ).to.be.revertedWith("You dont have any unstaked to withdraw");

    await expect(
      simpleStaking
        .connect(test1)
        .withdrawUnstaked(stakeToken.address, ethers.utils.parseUnits("1000.0", decimals))
    ).to.be.revertedWith("Can not withdraw over unstaked amount");

    await simpleStaking
      .connect(test1)
      .withdrawUnstaked(stakeToken.address, ethers.utils.parseUnits("500.0", decimals));
  });

  it("withdrawReward function", async () => {
    await expect(
      simpleStaking
        .connect(test1)
        .withdrawReward(rewardToken.address, ethers.utils.parseUnits("0.0", decimals))
    ).to.be.revertedWith("Can not withdraw nothing");

    await expect(
      simpleStaking
        .connect(test1)
        .withdrawReward(test2.address, ethers.utils.parseUnits("1000.0", decimals))
    ).to.be.revertedWith("You dont have any reward to withdraw");

    await expect(
      simpleStaking
        .connect(test1)
        .withdrawReward(rewardToken.address, ethers.utils.parseUnits("1000.0", decimals))
    ).to.be.revertedWith("Can not withdraw over reward amount");

    await simpleStaking
      .connect(test1)
      .withdrawReward(rewardToken.address, ethers.utils.parseUnits("1.0", decimals));
  });
});
