const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { WrapperBuilder } = require("redstone-evm-connector");

const { BigNumber, provider } = ethers;

const { fixture } = require("../utils");

const { ZERO_ADDR } = require("./../../helpers.js")

const { bondFixture, ASSETS, VAULTS } = require("./fixtures/bond_fixture");

const {
  parseUnits,
  evmSnapshot,
  evmRevert,
  timeTravel,
} = require("../../helpers");

const DEBUG = true;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/// ERC3525 Glossary

// A 'slot' is a container-type. In FujiBonds: a 'slot' is a specific vesting schedule.
// A token Id is a unique container of type 'slot'. In FujiBonds: a token Id is container of bonds.
// All token Ids with the same slot are compatible. They have the same vesting schedule.
// Units of a token Id are the bonds. Each bond unit, depending on slot, is redeemable for Fuji tokens.

describe("Bond Functionality", function () {

  let admin;
  let users;
  let user;
  let otherUser;
  let operator;

  let nftgame;
  let nftinteractions;
  let pretokenbond;

  let evmSnapshot0;
  let cardIds;
  let slotsIdArray;
  let pointsDecimals;

  before(async () => {
    users = await ethers.getSigners();

    admin = users[0];
    user = users[1];
    otherUser = users[2];
    operator = users[3];

    const loadFixture = createFixtureLoader(users, provider);

    const fixtureItems = await loadFixture(bondFixture);

    pretokenbond = fixtureItems.pretokenbond;
    nftgame = fixtureItems.nftgame;
    nftinteractions = fixtureItems.nftinteractions;
    cardIds = fixtureItems.cardIds;
    pointsDecimals = fixtureItems.pointsDecimals;

    // Force mint points for 'user'
    await nftgame.mint(user.address, 0, parseUnits(200, pointsDecimals));

    // Mint All cardIDs for 'user'
    for (let index = cardIds[0]; index <= cardIds[1]; index++) {
      await nftgame.connect(admin).mint(index, user.address);
    }

    // Move to trading phase.
    await timeTravel(fixtureItems.day + 1);

    await nftinteractions.connect(user).lockFinalScore();

    slotsIdArray = await pretokenbond.getBondVestingTimes();
    evmSnapshot0 = await evmSnapshot();
  });

  after(async () => {
    evmRevert(evmSnapshot0);
  });

  describe("Basic Bond ERC721 Functionality", () => {

    before(async () => {
      // Admin force mint vouchers
      //with the following number of Bond Units in each slot-vesting type
      const numberOfBondUnits = 5;

      // Vouchers/token ids minted by admin.
      for (let index = 0; index < slotsIdArray.length; index++) {
        await pretokenbond.connect(admin).mint(
          user.address,
          index,
          numberOfBondUnits
        );
      }
    });

    after(async () => {
      evmRevert(evmSnapshot0);
    });

    it("Return value when calling 'balanceOf'", async () => {
      const bal = await pretokenbond.balanceOf(user.address);
      expect(bal).to.equal(slotsIdArray.length);
    });

    it("Revert when calling 'balanceOf' address 0", async () => {
      await expect(pretokenbond.balanceOf(ZERO_ADDR)).to.be.reverted;
    });

    it("Returns owner of token ID when calling 'ownerOf'", async () => {
      let tempowner;
      for (let index = 1; index < slotsIdArray.length + 1; index++) {
        tempowner = await pretokenbond.ownerOf(index);
        expect(tempowner).to.eq(user.address);
      }
    });

    it("Succesfully transfer tokenID", async () => {
      const tokenID = 1;
      const localcontract = pretokenbond.connect(user);
      await localcontract.functions['transferFrom(address,address,uint256)'](user.address, otherUser.address, tokenID);
      const balOtherUser = await pretokenbond.balanceOf(otherUser.address);
      const owner = await pretokenbond.ownerOf(tokenID);
      expect(balOtherUser).to.eq(1);
      expect(owner).to.eq(otherUser.address);
    });

    it("Returns the account approved for `tokenId`", async () => {
      const tokenID = 1;
      const localcontract = pretokenbond.connect(otherUser);
      await localcontract.functions['approve(address,uint256)'](user.address, tokenID);
      const approvedUser = await pretokenbond.getApproved(tokenID);
      expect(approvedUser).to.eq(user.address);
    });

    it("Succesfully transfer the approved `tokenId`", async () => {
      const tokenID = 1; // This tokenID must be the same as in previous test.
      const localcontract = pretokenbond.connect(user);
      await localcontract.functions['transferFrom(address,address,uint256)'](otherUser.address, user.address, tokenID);
      const owner = await pretokenbond.ownerOf(tokenID);
      expect(owner).to.eq(user.address);
    });

    it("Succesfully approve `operator` and performs transfer", async () => {
      const tokenID = 2;
      await pretokenbond.connect(user).setApprovalForAll(operator.address, true);
      const localcontract = pretokenbond.connect(operator);
      await localcontract.functions['transferFrom(address,address,uint256)'](user.address, otherUser.address, tokenID);
      const owner = await pretokenbond.ownerOf(tokenID);
      expect(owner).to.eq(otherUser.address);
    });

    it("Succesfully remove `operator` and reverts when trying transfer", async () => {
      const tokenID = 3;
      await pretokenbond.connect(user).setApprovalForAll(operator.address, false);
      const localcontract = pretokenbond.connect(operator);
      await expect(
        localcontract.functions['transferFrom(address,address,uint256)'](user.address, otherUser.address, tokenID)
      ).to.be.reverted;
    });
  });

  describe.only("Basic Bond ERC3525 Functionality", () => {

    let numberOfBondUnits;

    before(async () => {
      // Admin force mint vouchers
      //with the following number of Bond Units in each slot-vesting type
      numberOfBondUnits = 5;

      // Vouchers/token ids minted by admin directly from 'PreTokenBonds.sol'.
      for (let index = 0; index < slotsIdArray.length; index++) {
        await pretokenbond.mint(user.address, index, numberOfBondUnits);
      }
    });

    after(async () => {
      evmRevert(this.evmSnapshot0);
    });

    it("Returns 'slot' type for each token Id", async () => {
      // Find the slot of a tokenID 'voucherSlotMapping(uint256 _tokenId)'
      let tempTokenID;
      for (let index = 0; index < slotsIdArray.length; index++) {
        // Minted 'vouchers' tokenIds are enummerable, starting at 1.
        tempTokenID = index + 1;
        const slot = await pretokenbond.voucherSlotMapping(tempTokenID);
        expect(slot).to.eq(slotsIdArray[index]);
      }
    });

    it("Returns supply of token ids with 'slot' type", async () => {
      // Count all # of vouchers in the same slot. 'tokensInSlot(uint256 _slot)'
      let numOfTokens;
      for (let index = 0; index < slotsIdArray.length; index++) {
        numOfTokens = await pretokenbond.tokensInSlot(slotsIdArray[index]);
        // For each slot type, 1 voucher was minted for'user': see 'before' in this block.
        expect(numOfTokens).to.eq(1); 
      }
    });

    it("Returns decimals of the 'units' of a token Id ", async () => {
      // Number of decimals a token uses for units 'unitDecimals()'
      // Decimals should match those defined in 'NFTGame.sol'
      expect(await pretokenbond.unitDecimals()).to.equal(pointsDecimals);
    });

    it("Returns token Id when calling slot and index", async () => {
      // Returns the token id for the `_index`th token in the token list 
      // of the slot 'tokenOfSlotByIndex(uint256 _slot, uint256 _index)'
      const dummyIndex = 0;
      expect(await pretokenbond.tokenOfSlotByIndex(slotsIdArray[0], dummyIndex)).to.eq(1);
    });

    it("Should return bond 'units' when token Id is passed", async () => {
      // The amount of units of `_tokenId` 'unitsInToken(uint256 _tokenId)'
      const dummytokenID = 1;
      expect(await pretokenbond.unitsInToken(dummytokenID)).to.eq(numberOfBondUnits)
    });

    it("Should approve and transfer succesfully 'units' of token Id to another token Id of the same slot", async () => {
      // approve(address _to, uint256 _tokenId, uint256 _units), allowance(uint256 _tokenId, address _spender)
      // transferFrom(address _from, address _to, uint256 _tokenId, uint256 _targetTokenId, uint256 _units) external;

      // New voucher minted by admin directly from 'PreTokenBonds.sol' to 'otherUser'. Type 3-months
      const month3typeVoucher = 0;
      const receiverDumbTokenId = await pretokenbond.callStatic.mint(otherUser.address, month3typeVoucher, numberOfBondUnits);
      await pretokenbond.mint(otherUser.address, month3typeVoucher, numberOfBondUnits);

      const dummyApprovertokenID = 1;
      const dumbAmountOfUnitsToApprove = ethers.BigNumber.from([2]);

      let approver = user;
      let spender = otherUser;

      // Verify that the receiverDumbTokenId is owned by the spender.
      expect(await pretokenbond.ownerOf(receiverDumbTokenId)).to.eq(spender.address);
      console.log("pass1");

      // Verify that the token Ids 'from' and 'to' are of the same slot.
      expect(
        await pretokenbond.voucherSlotMapping(dummyApprovertokenID)
      ).to.eq(
        await pretokenbond.voucherSlotMapping(receiverDumbTokenId)
      );
      console.log("pass2");

      const unitsInReceiverTokenId = await pretokenbond.unitsInToken(receiverDumbTokenId);

      const acontract = pretokenbond.connect(approver);
      await acontract.functions['approve(address,uint256,uint256)'](spender.address, dummyApprovertokenID, dumbAmountOfUnitsToApprove);

      // Verify allowance if equat to 'dumbAmountOfUnitsToApprove'
      expect(
        await pretokenbond.allowance(dummyApprovertokenID, spender.address)
      ).to.eq(dumbAmountOfUnitsToApprove);
      console.log("pass3");

      const scontract = pretokenbond.connect(spender);
      await scontract.functions['transferFrom(address,address,uint256,uint256,uint256)'](
        approver.address,
        spender.address,
        dummyApprovertokenID,
        receiverDumbTokenId,
        dumbAmountOfUnitsToApprove
      );

      // Verify 'units' of 'receiverDumbTokenId' increased after 'transferFrom'
      expect(
        await pretokenbond.unitsInToken(receiverDumbTokenId)
      ).to.eq(
        unitsInReceiverTokenId.add(dumbAmountOfUnitsToApprove)
      );
      console.log("pass4");
    });

    it.only("Should split token Id and 'units' should match split amount", async () => {
      // Split a token into several by separating its units and assigning each portion to a new created token.
      const dummytokenID = 6;
      const dummyAmountToSplit = 3;
      let splitterUser = await pretokenbond.ownerOf(dummytokenID);
      spliiterUser = splitterUser == user.address ? user : otherUser;
      const nextTokenId = (await pretokenbond.nextTokenId()) + 1;
      await pretokenbond.connect(spliiterUser).splt(dummytokenID, dummyAmountToSplit);
      expect(
        await pretokenbond.unitsInToken(nextTokenId)
      ).to.equal(
        ethers.BigNumber.from([dummyAmountToSplit])
      );
    });

    it("Should merge token Ids of the same slot", async () => {
      // Merge several tokens into one by merging their units into a target token before burning them.
      const dummytokenID = ethers.BigNumber.from([6]); // Should be the same as previous test.
      const lastTokenId = await pretokenbond.nextTokenId();
      await pretokenbond.merge([dummytokenID, lastTokenId], dummytokenID);
      expect(
        await pretokenbond.unitsInToken(dummytokenID)
      ).to.eq(
        ethers.BigNumber.from(this.numberOfBondUnits)
      );
      expect(
        await pretokenbond.unitsInToken(lastTokenId)
      ).to.eq(0);
    });

    it("Should transfer 'units' of token Id to new token Id", async () => {
      // transferFrom(address _from, address _to, uint256 _tokenId, uint256 _units)
      const dummytokenID = 11;
      const dumbAmountOfBondsToTrasnfer = 4;
      const newTokenId = (await pretokenbond.newTokenId()) + 1;
      await pretokenbond.connect(user)
        .transferFrom(
          user.address,
          otherUser.address,
          dummytokenID,
          dumbAmountOfBondsToTrasnfer
        );
      expect(
        await pretokenbond.ownerOf(newTokenId)
      ).to.eq(
        otherUser.address
      );
      expect(
        await pretokenbond.unitsInToken(newTokenId)
      ).to.eq(
        ethers.BigNumber.from([dumbAmountOfBondsToTrasnfer])
      );
    });

  });

  describe("Fuji Bond Specific Functionality", function () {

    after(async () => {
      evmRevert(this.evmSnapshot0);
    });

    it("Should return a value for price of mining a token ID", async () => {

    });

    it("Should return value for the vesting time for different 'slots'", async () => {

    });

    it("Should allow to mint a token ID with zero units before end of bond phase", async () => {

    });

    it("Should revert if try to mint a token Id after bond phase", async () => {

    });


  });


});