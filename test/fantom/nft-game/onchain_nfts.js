const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { provider } = ethers;
const { bondFixture } = require("./fixtures/bond_fixture");

const {
  parseUnits,
  evmSnapshot,
  evmRevert,
  timeTravel
} = require("../../helpers");

const DEBUG = true;

describe("On-chain Metadata Generation Tests", function () {

  let admin;
  let users;
  let user;

  let evmSnapshot0;
  let evmSnapshot1;
  let fixtureItems;

  let now;
  let day;
  let cardIds;
  let pointsDecimals;
  let initialPoints;

  let nftgame;
  let nftinteractions;
  let pretokenbond;
  let vdescriptor;
  let vsvg;
  let ldescriptor;
  let lsvg;

  before(async () => {
    users = await ethers.getSigners();
    admin = users[0];
    user = users[1];

    const loadFixture = createFixtureLoader(users, provider);
    fixtureItems = await loadFixture(bondFixture);

    nftgame = fixtureItems.nftgame;
    nftinteractions = fixtureItems.nftinteractions;
    pretokenbond = fixtureItems.pretokenbond;
    vdescriptor = fixtureItems.vdescriptor;
    vsvg = fixtureItems.vsvg;
    ldescriptor = fixtureItems.ldescriptor;
    lsvg = fixtureItems.lsvg;

    now = fixtureItems.now;
    day = fixtureItems.day;
    cardIds = fixtureItems.cardIds;
    pointsDecimals = fixtureItems.pointsDecimals;

    // Force mint points for 'user'
    initialPoints = parseUnits(575000, pointsDecimals);
    await nftgame.mint(user.address, 0, initialPoints);

    // Force mint all cardIDs for 'user'
    for (let index = cardIds[0]; index <= cardIds[1]; index++) {
      await nftgame.connect(admin).mint(user.address, index, 1);
    }

    // Move to trade and lock phase
    await timeTravel(day + 1);

    // Perform lock user
    await nftinteractions.connect(user).lockFinalScore();
  });

  describe("Lock NFT metadata and image", async () => {

    let baseURI;

    before(async ()=> {
      // Set the baseURI
      baseURI = 'https://example.com/metadata/';
      await nftgame.setBaseURI(baseURI);
    });

    beforeEach(async function () {
      if (evmSnapshot1) await evmRevert(evmSnapshot1);
      evmSnapshot1 = await evmSnapshot();
    });

    after(async () => {
      evmRevert(evmSnapshot0);
    });

    it("Should confirm user is succesfully locked", async () => {
      const userData = await nftgame.userdata(user.address);
      const totalCards = await nftgame.nftCardsAmount();
      expect(userData.lockedNFTID).to.be.gt(0);
      expect(userData.gearPower).to.eq(totalCards);
      expect(userData.finalScore).to.be.gt(initialPoints);
    });

    it("Should revert when passing a wrong lockedNFTId to URI()", async () => {
      const fakeLockNFTId = 1256489;
      await expect(nftgame.uri(fakeLockNFTId)).to.be.reverted;
    });

    it("Should return baseURI+cardId when passing card Ids to URI()", async () => {
      for (let index = cardIds[0]; index <= cardIds[1]; index++) {
        expect(await nftgame.uri(index)).to.eq(`${baseURI}${index}`);
      }
    });

    it("Should console.log() base64 encoded lockNFT metadata", async () => {
      const userData = await nftgame.userdata(user.address);
      const metadata = await nftgame.uri(userData.lockedNFTID);
      console.log(metadata);
    });

    it("Should set nickname succesfully and console.log base64 lockNFT metadata", async () => {
      const userData = await nftgame.userdata(user.address);
      await lsvg.connect(user).setNickname(userData.lockedNFTID, "HomeDestroyer");
      const metadata = await nftgame.uri(userData.lockedNFTID);
      console.log(metadata);
    });
  });
});