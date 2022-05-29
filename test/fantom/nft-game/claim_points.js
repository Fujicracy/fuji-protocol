const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const pointsData = require('./sample-merkle-leaves.json');

const { provider } = ethers;

const abiCoder = ethers.utils.defaultAbiCoder;

const { quickFixture } = require("./fixtures/quick_test_fixture");

const {
  evmSnapshot,
  evmRevert,
} = require("../../helpers");

const DEBUG = false;

describe("Claiming Bonus Points Tests", function () {

  let users;
  let owner;
  let eligibleUser;
  let eligibleUserNumber;
  let nonEligibleUser;

  let nftgame;
  let nftinteractions;

  let evmSnapshot0;

  let leaves;
  let merkletree;
  let merkleroot;
  let points_ID;

  before(async () => {

    // Test case users set-up
    users = await ethers.getSigners();
    owner = users[0];
    eligibleUserNumber = 2;
    eligibleUser = users[eligibleUserNumber];
    nonEligibleUser = users[19];

    const loadFixture = createFixtureLoader(users, provider);
    f = await loadFixture(quickFixture);
    nftgame = f.nftgame;
    nftinteractions = f.nftinteractions;

    points_ID = await nftgame.POINTS_ID();

    // Build merkletree and set merkleRoot
    leaves = pointsData.map( element => {
      return keccak256(
        abiCoder.encode(["address", "uint256"], [element[0], element[1]]));
    });

    if (DEBUG) {
      console.log(leaves);
    }

    merkletree = new MerkleTree(leaves, keccak256, { hashLeaves: false, sortPairs: true });
    merkleroot = merkletree.getHexRoot();
    
    await nftgame.connect(owner).setMerkleRoot(merkleroot);

    evmSnapshot0 = await evmSnapshot();
  });

  afterEach(async function () {
    await evmRevert(evmSnapshot0);
  });

  it("Should revert when nonEligibleUser claims ", async function () {
    const pretendedProof = merkletree.getHexProof(leaves[0]);
    const pretendedPoints = ethers.BigNumber.from(pointsData[0][1].toString());

    const readPoints = await nftgame.balanceOf(nonEligibleUser.address, points_ID);
    await expect(nftgame.connect(nonEligibleUser)
    .claimBonusPoints(pretendedPoints, pretendedProof)).to.be.revertedWith("Invalid merkle proof");
    expect(await nftgame.balanceOf(nonEligibleUser.address, points_ID)).to.eq(readPoints);
  });

  it("Should give points when eligibleUser claims ", async function () {
    const realProof = merkletree.getHexProof(leaves[eligibleUserNumber]);
    const headPoints = ethers.BigNumber.from(pointsData[eligibleUserNumber][1].toString());

    const readPointsBefore = await nftgame.balanceOf(eligibleUser.address, points_ID);
    
    await nftgame.connect(eligibleUser).claimBonusPoints(headPoints, realProof);

    const readPointsAfter = await nftgame.balanceOf(eligibleUser.address, points_ID);

    expect(readPointsAfter).to.eq(headPoints);
    expect(readPointsAfter).to.be.gt(readPointsBefore);
  });

  it("Should revert when an eligibleUser tries to claim twice", async function () {
    const newEligibleUserNumber = eligibleUserNumber + 1;
    const newEligibleUser = users[newEligibleUserNumber];
    const realProof = merkletree.getHexProof(leaves[newEligibleUserNumber]);
    const headPoints = ethers.BigNumber.from(pointsData[newEligibleUserNumber][1].toString());
    // First try ok
    await nftgame.connect(newEligibleUser).claimBonusPoints(headPoints, realProof);
    // Second try should revert.
    await expect(nftgame.connect(newEligibleUser).claimBonusPoints(headPoints, realProof)).to.be.revertedWith("Points already claimed!");
  });

});
