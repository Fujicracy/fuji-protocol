const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { BigNumber, provider } = ethers;

const { ZERO_ADDR } = require("./../../helpers.js")

const { bondFixture } = require("./fixtures/bond_fixture");

const {
  parseUnits,
  evmSnapshot,
  evmRevert,
  timeTravel,
} = require("../../helpers");

const DEBUG = true;

const ZERO_BN = ethers.BigNumber.from("0");

describe("CardBoost Quick Test", function () {

  let admin;
  let users;
  let user;
  let otherUser;

  let fixtureItems;
  let nftgame;
  let nftinteractions;
  
  let evmSnapshot0;
  let evmSnapshot1;
  let initialPoints;
  let cardIds;
  let pointsDecimals;
  let cards;

  const TEST_CARDBOOST = 25;
  let expectedBoostAllCards;

  before(async () => {
    users = await ethers.getSigners();

    admin = users[0];
    user = users[1];
    otherUser = users[2];
    operator = users[3];

    const loadFixture = createFixtureLoader(users, provider);

    fixtureItems = await loadFixture(bondFixture);

    nftgame = fixtureItems.nftgame;
    nftinteractions = fixtureItems.nftinteractions;
    cardIds = fixtureItems.cardIds;
    pointsDecimals = fixtureItems.pointsDecimals;

    // Set cardBoost to a especific value 'TEST_CARDBOOST' for testing
    for (let index = cardIds[0]; index <= cardIds[1]; index++) {
      await nftinteractions.connect(admin).setCardBoost(index, TEST_CARDBOOST);
    }

    cards = await nftgame.nftCardsAmount();
    expectedBoostAllCards = 100 + cards * TEST_CARDBOOST;

    evmSnapshot0 = await evmSnapshot();
  });

  beforeEach(async function () {
    if (evmSnapshot1) await evmRevert(evmSnapshot1);
    evmSnapshot1 = await evmSnapshot();
  });

  after(async () => {
    evmRevert(evmSnapshot0);
  });

  it("Should return 100 when 'user' has not NFT cards", async () => {
    const boost = await nftinteractions.computeBoost(user.address);
    expect(100).to.eq(boost);
  });

  it("Should return 100 + 'TEST_CARDBOOST' when 'user' has 1 unqiue NFT cards", async () => {
    await nftgame.connect(admin).mint(user.address, cardIds[0], 1);
    const boost = await nftinteractions.computeBoost(user.address);
    expect(125).to.eq(boost);
  });

  it("Should return 'expectedBoostAllCards' when 'user' has ALL unique NFT cards", async () => {
    const cardsToMint = 1;
    // Mint All cardIDs for 'user' except already minted ones.
    for (let index = cardIds[0]; index <= cardIds[1]; index++) {
      await nftgame.connect(admin).mint(user.address, index, cardsToMint);
      const bal = await nftgame.balanceOf(user.address, index);
      expect(cardsToMint).to.eq(bal);
    }
    const boost = await nftinteractions.computeBoost(user.address);
    expect(expectedBoostAllCards).to.eq(boost);
  });

  it("Boost stack, 2 of each same card", async () => {
    const cardsToMint = 2;
    // Mint all cardIDs (again) for 'user'
    for (let index = cardIds[0]; index <= cardIds[1]; index++) {
      await nftgame.connect(admin).mint(user.address, index, cardsToMint);
      const bal = await nftgame.balanceOf(user.address, index);
      expect(cardsToMint).to.eq(bal);
    }
    const boost = await nftinteractions.computeBoost(user.address);

    const finalBoost = expectedBoostAllCards + cards * Math.floor(TEST_CARDBOOST / 2);
    expect(finalBoost).to.eq(boost);
  });

  it("Boost stack, boost should be 0 after 4th card", async () => {
    const cardsToMint = 6;
    // Mint all cardIDs (again) for 'user'
    for (let index = cardIds[0]; index <= cardIds[1]; index++) {
      await nftgame.connect(admin).mint(user.address, index, cardsToMint);
      const bal = await nftgame.balanceOf(user.address, index);
      expect(cardsToMint).to.eq(bal);
    }
    const boost = await nftinteractions.computeBoost(user.address);

    // const finalBoost = expectedBoostAllCards + cards * Math.floor(TEST_CARDBOOST / 2);
    let finalBoost = expectedBoostAllCards;
    for (let j = 1; j < 4; j++) {
      finalBoost += cards * Math.floor(TEST_CARDBOOST / 2 ** j);
    }

    expect(finalBoost).to.eq(boost);
  });
});
