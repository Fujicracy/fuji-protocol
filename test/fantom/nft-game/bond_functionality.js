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

  let fixtureItems;
  let nftgame;
  let nftinteractions;
  let pretokenbond;
  let mocktoken;

  let evmSnapshot0;
  let initialPoints;
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

    fixtureItems = await loadFixture(bondFixture);

    pretokenbond = fixtureItems.pretokenbond;
    nftgame = fixtureItems.nftgame;
    nftinteractions = fixtureItems.nftinteractions;
    cardIds = fixtureItems.cardIds;
    pointsDecimals = fixtureItems.pointsDecimals;

    // Force mint points for 'user'
    initialPoints = parseUnits(200, pointsDecimals);
    await nftgame.mint(user.address, 0, initialPoints);

    // Mint All cardIDs for 'user'
    for (let index = cardIds[0]; index <= cardIds[1]; index++) {
      await nftgame.connect(admin).mint(user.address, index, 1);
    }

    // Move to trading phase.
    await timeTravel(fixtureItems.day + 1);

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
          slotsIdArray[index],
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

  describe("Basic Bond ERC3525 Functionality", () => {

    // Variables used in more than one test.
    let numberOfBondUnits;
    let splitterUser;
    let dummytokenIDtoSplit;
    let newTokenId;

    before(async () => {
      // Admin force mint vouchers
      //with the following number of Bond Units in each slot-vesting type
      numberOfBondUnits = 5;

      // Vouchers/token ids minted by admin directly from 'PreTokenBonds.sol'.
      for (let index = 0; index < slotsIdArray.length; index++) {
        await pretokenbond.mint(user.address, slotsIdArray[index], numberOfBondUnits);
      }
    });

    after(async () => {
      evmRevert(evmSnapshot0);
    });

    it("Returns 'slot' type for each token Id", async () => {
      // Find the slot of a tokenID 'voucherSlotMapping(uint256 _tokenId)'
      let tempTokenID;
      for (let index = 0; index < slotsIdArray.length; index++) {
        // Minted 'vouchers' token Ids are enummerable, starting at 1.
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
      const month3Vesting = 3;
      expect(await pretokenbond.tokenOfSlotByIndex(month3Vesting, dummyIndex)).to.eq(1);
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
      const month3Vesting = 3;
      const receiverDumbTokenId = await pretokenbond.callStatic.mint(otherUser.address, month3Vesting, numberOfBondUnits);
      await pretokenbond.mint(otherUser.address, month3Vesting, numberOfBondUnits);

      const dummyApprovertokenID = 1;
      const dumbAmountOfUnitsToApprove = BigNumber.from([2]);

      let approver = user;
      let spender = otherUser;

      // Verify that the receiverDumbTokenId is owned by the spender.
      expect(await pretokenbond.ownerOf(receiverDumbTokenId)).to.eq(spender.address);

      // Verify that the token Ids 'from' and 'to' are of the same slot.
      expect(
        await pretokenbond.voucherSlotMapping(dummyApprovertokenID)
      ).to.eq(
        await pretokenbond.voucherSlotMapping(receiverDumbTokenId)
      );

      const unitsInReceiverTokenId = await pretokenbond.unitsInToken(receiverDumbTokenId);

      const acontract = pretokenbond.connect(approver);
      await acontract.functions['approve(address,uint256,uint256)'](spender.address, dummyApprovertokenID, dumbAmountOfUnitsToApprove);

      // Verify allowance if equat to 'dumbAmountOfUnitsToApprove'
      expect(
        await pretokenbond.allowance(dummyApprovertokenID, spender.address)
      ).to.eq(dumbAmountOfUnitsToApprove);

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
    });

    it("Should split token Id and 'units' should match split amount", async () => {
      // Split a token into several by separating its units and assigning each portion to a new created token.
      dummytokenIDtoSplit = 2;
      const dummyAmountToSplit = 3;
      splitterUser = await pretokenbond.ownerOf(dummytokenIDtoSplit);
      splitterUser = splitterUser == user.address ? user : otherUser;
      newTokenId = await pretokenbond.nextTokenId();
      await pretokenbond.connect(splitterUser).split(dummytokenIDtoSplit, [dummyAmountToSplit]);
      expect(
        await pretokenbond.unitsInToken(newTokenId)
      ).to.equal(
        BigNumber.from([dummyAmountToSplit])
      );
    });

    it("Should merge token Ids of the same slot", async () => {
      // Merge several tokens into one by merging their units into a target token before burning them.
      // Take split tokens from last test.
      const tokenIDToMergeFrom = dummytokenIDtoSplit;
      const lastTokenIDSplit = newTokenId;

      // New voucher minted by admin directly from 'PreTokenBonds.sol' to 'otherUser' with one bond
      // Required for result merge.
      let slotType = await pretokenbond.slotOf(tokenIDToMergeFrom);
      const finalMergeTokenId = await pretokenbond.callStatic.mint(splitterUser.address, slotType, 1);
      await pretokenbond.mint(splitterUser.address, slotType, 1);

      // Merge operation.
      await pretokenbond.connect(splitterUser).merge([tokenIDToMergeFrom, lastTokenIDSplit], finalMergeTokenId);

      expect(
        await pretokenbond.unitsInToken(finalMergeTokenId)
      ).to.eq(
        BigNumber.from([numberOfBondUnits + 1])
      );
      expect(
        await pretokenbond.unitsInToken(tokenIDToMergeFrom)
      ).to.eq(0);
    });

    it("Should transfer 'units' of token Id to new token Id", async () => {
      // transferFrom(address _from, address _to, uint256 _tokenId, uint256 _units)
      const dummytokenID = 3;
      const dumbAmountOfBondsToTrasnfer = 4;
      const newTokenId = await pretokenbond.nextTokenId();
      const lcontract = pretokenbond.connect(user);
      await lcontract.functions['transferFrom(address,address,uint256,uint256)'](
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
        BigNumber.from([dumbAmountOfBondsToTrasnfer])
      );
    });

  });

  describe("Fuji Bond Specific Functionality", () => {
    
    let amountmocktoken;
    let endOfAccumulationTimestamp;
    let endOfTradeLockTimestamp;
    let endOfBondTimestamp;
    let latestUserTokenBal;

    // These variables are used cross-tests
    let firstTokenId;
    let secondTokenId;
    let thirdTokenId;

    before(async () => {
      console.log("\t"+"Tests in this block should be run in series.");

      mocktoken = fixtureItems.mocktoken;

      amountmocktoken = parseUnits(3000000);

      // Mint mock token for admin
      await mocktoken.mint(mocktoken.signer.address, amountmocktoken);

      // Extending the accumulating phase

      endOfAccumulationTimestamp = fixtureItems.phases[0] + fixtureItems.day * 2;
      endOfTradeLockTimestamp = endOfAccumulationTimestamp + fixtureItems.day;
      endOfBondTimestamp = endOfTradeLockTimestamp + fixtureItems.day;

      const newPhases = [
        fixtureItems.phases[0],     // 0 = start game launch
        endOfAccumulationTimestamp, // 1 = end of accumulation
        endOfTradeLockTimestamp,    // 2 = end of trade and lock
        endOfBondTimestamp          // 3 = end of bond
      ];

      latestUserTokenBal = BigNumber.from([0]);

      await nftgame.setGamePhases(newPhases);
      const dummyAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
      // Dummy address set to allow functionality tests to run.
      await nftgame.setLockNFTDescriptor(dummyAddress);
    });

    after(async () => {
      evmRevert(evmSnapshot0);
    });

    it("Should return a value for price per bond 'units'", async () => {
      // A default bond price is set at calling 'initialize()'
      const bondPrice = await pretokenbond.bondPrice();
      expect(bondPrice).to.be.gt(0);
    });

    it("Only admin should be able to change price of bonds 'units'", async () => {
      // 'user' should not be able to set price.
      await expect(pretokenbond.connect(user).setBondPrice(1)).to.be.reverted;
      const newBondPrice = parseUnits(2, pointsDecimals);
      await pretokenbond.setBondPrice(newBondPrice);
      expect(await pretokenbond.bondPrice()).to.eq(newBondPrice);
    });

    it("Should return value for the vesting time for different 'slots'", async () => {
      // Vesting times are used to check internally claiming.
      const vestingTimes = await pretokenbond.getBondVestingTimes();
      const expectedDefaultVestingTimes = [
        BigNumber.from("3"),
        BigNumber.from("6"),
        BigNumber.from("12")
      ];
      for (let index = 0; index < expectedDefaultVestingTimes.length; index++) {
        expect(expectedDefaultVestingTimes[index].eq(vestingTimes[index])).to.eq(true); 
      }
      
    });

    it("Should revert if user tries to mint voucher before accumulation phase ends", async () => {
      const numberOfBondUnits = parseUnits(5, pointsDecimals);
      const month3Vesting = 3;
      const phase = await nftgame.getPhase();
      expect(phase).to.eq(1);
      await expect(
        nftinteractions.connect(user).mintBonds(month3Vesting, numberOfBondUnits)
      ).to.be.reverted;
    });

    it("Should mint voucher only after accumulation phase ends, 'user' is locked, with points from 'NFTGame'", async () => {
      // Moved to trading phase
      await timeTravel(fixtureItems.day + 1);
      const phase = await nftgame.getPhase();
      expect(phase).to.eq(2);

      // Mint the bonds
      const numberOfBondUnits = parseUnits(5, pointsDecimals);
      const month3Vesting = 3;
      
      await expect(
        nftinteractions.connect(user).mintBonds(month3Vesting, numberOfBondUnits)
      ).to.be.revertedWith("G04");

      // 'user' locks in points.
      await nftinteractions.connect(user).lockFinalScore();
      const lockedBalance = await nftgame.balanceOf(user.address, 0);

      // 'user' mints voucher.
      const lnftinteractions = nftinteractions.connect(user);
      // 'firstTokenId' is required in future tests. 
      firstTokenId = await lnftinteractions.callStatic.mintBonds(month3Vesting, numberOfBondUnits);
      await lnftinteractions.mintBonds(month3Vesting, numberOfBondUnits);
      const owner = await pretokenbond.ownerOf(firstTokenId);
      expect(owner).to.eq(user.address);

      // checks 'user' points are deducted.
      const bondPrice = await pretokenbond.bondPrice();
      const costOfVoucher = bondPrice.mul(numberOfBondUnits).div(parseUnits(1, pointsDecimals));
      const newBalance = await nftgame.balanceOf(user.address, 0);
      expect(newBalance).to.eq(lockedBalance.sub(costOfVoucher));
    });

    it("Should revert if user tries to mint directly from 'PreTokenBonds.sol' contract", async () => {
      const numberOfBondUnits = parseUnits(5, pointsDecimals);
      const month3Vesting = 3;
      await expect(
        pretokenbond.connect(user).mint(user.address, month3Vesting, numberOfBondUnits)
      ).to.be.reverted;
    });

    it("Should not be able to mint voucher after bonding phase ends", async () => {
      // Mint 1 voucher of each type before moving to trading phase.
      const numberOfBondUnits = parseUnits(5, pointsDecimals);
      const month6Vesting = 6;
      const month12Vesting = 12;
      const lnftinteractions = nftinteractions.connect(user);

      // 'secondTokenId' and 'thirdTokenId' are required in future tests.
      secondTokenId = await lnftinteractions.callStatic.mintBonds(month6Vesting, numberOfBondUnits);
      await lnftinteractions.mintBonds(month6Vesting, numberOfBondUnits);
      thirdTokenId = await lnftinteractions.callStatic.mintBonds(month12Vesting, numberOfBondUnits);
      await lnftinteractions.mintBonds(month12Vesting, numberOfBondUnits);

      // Moved to end bonding phase
      await timeTravel(fixtureItems.day * 3 + 1);
      const phase = await nftgame.getPhase();
      expect(phase).to.eq(4);

      // Revert expected now in bonding phase.
      await expect(
        lnftinteractions.mintBonds(month6Vesting, numberOfBondUnits)
      ).to.be.reverted;
    });

    it("Should return expected default multipliers", async () => {
      const expectedMultipliers = [
        BigNumber.from([1]),
        BigNumber.from([2]),
        BigNumber.from([4])
      ];
      let multiplier;
      for (let index = 0; index < expectedMultipliers.length; index++) {
        multiplier = await pretokenbond.bondSlotMultiplier(slotsIdArray[index]);
        expect(multiplier).to.eq(expectedMultipliers[index]);
      }
    });

    it("Should return zero when calling 'tokensPerUnit(uint256)' if no token deposit has been performed", async () => {
      for (let index = 0; index < slotsIdArray.length; index++) {
        expect(await pretokenbond.tokensPerUnit(slotsIdArray[index])).to.eq(0);
      }
    });

    it("Should perform succesfull token deposit in {PreTokenBond.sol} by admin only", async () => {
      expect(await mocktoken.balanceOf(pretokenbond.address)).to.eq(0);

      // User tries to make deposit
      await expect(pretokenbond.connect(user).deposit(amountmocktoken)).to.be.reverted;

      // Admin approves tokens for deposit
      await mocktoken.approve(pretokenbond.address, amountmocktoken);

      // Admin succesfully deposits token
      await pretokenbond.deposit(amountmocktoken);
      expect(await mocktoken.balanceOf(pretokenbond.address)).to.eq(amountmocktoken);
    });

    it("Should return correct values when calling 'tokensPerUnit(uint256)' after deposit has been performed", async () => {
      let tokenReturnValue = [];
      let unitsPerSlot = [];
      let multiplierValues = [];
      for (let index = 0; index < slotsIdArray.length; index++) {
        tokenReturnValue.push(await pretokenbond.tokensPerUnit(slotsIdArray[index]));
        expect(tokenReturnValue[index]).to.be.gt(0);
        unitsPerSlot.push(await pretokenbond.unitsInSlot(slotsIdArray[index]));
        multiplierValues.push(await pretokenbond.bondSlotMultiplier(slotsIdArray[index]));
      }
      
      const totalWeightedUnits = unitsPerSlot[0].add(unitsPerSlot[1].mul(multiplierValues[1])).add(unitsPerSlot[2].mul(multiplierValues[2]));
      const basicTokenPerUnit = amountmocktoken.mul(parseUnits(1, pointsDecimals)).div(totalWeightedUnits);
      
      const expectedTokensPerBond = [
        basicTokenPerUnit,
        basicTokenPerUnit.mul(BigNumber.from([2])),
        basicTokenPerUnit.mul(BigNumber.from([4]))
      ];

      for (let index = 0; index < expectedTokensPerBond.length; index++) {
        expect(expectedTokensPerBond[index]).to.eq(tokenReturnValue[index]) 
      }
    });

    it("Should succesfully claim tokens after 3 months", async () => {
      const month3TokenId = firstTokenId;
      // Moved to 3-months ahead
      await timeTravel(fixtureItems.day * 90 + 1);

      const expectedTokensPerBond = await pretokenbond.tokensPerUnit(slotsIdArray[0]);
      const unitsInToken = await pretokenbond.unitsInToken(month3TokenId);

      // Ensure 'user' is owner of token id, and that slot corresponds.
      expect(await pretokenbond.ownerOf(month3TokenId)).to.eq(user.address);
      expect(await pretokenbond.slotOf(month3TokenId)).to.eq(slotsIdArray[0]);
      // balance of mocktoken should be zero.
      expect(await mocktoken.balanceOf(user.address)).to.eq(0);

      // 'user' calls claim.
      await pretokenbond.connect(user).claim(month3TokenId);

      const userTokenBalance = await mocktoken.balanceOf(user.address);
      const newExpected = unitsInToken.mul(expectedTokensPerBond).div(parseUnits(1, pointsDecimals));
      latestUserTokenBal = latestUserTokenBal.add(newExpected);

      expect(userTokenBalance).to.eq(latestUserTokenBal);
    });

    it("Should succesfully claim tokens after 6 months", async () => {
      const month6TokenId = secondTokenId;
      // Move extra 3-months ahead from previous timeTravel
      await timeTravel(fixtureItems.day * 90 + 1);
      
      const expectedTokensPerBond = await pretokenbond.tokensPerUnit(slotsIdArray[1]);
      const unitsInToken = await pretokenbond.unitsInToken(month6TokenId);
      
      // Ensure 'user' is owner of token id, and that slot corresponds.
      await expect(await pretokenbond.ownerOf(month6TokenId)).to.eq(user.address);
      await expect(await pretokenbond.slotOf(month6TokenId)).to.eq(slotsIdArray[1]);

      // 'user' calls claim.
      await pretokenbond.connect(user).claim(month6TokenId);
      
      const userTokenBalance = await mocktoken.balanceOf(user.address);
      const newExpected = unitsInToken.mul(expectedTokensPerBond).div(parseUnits(1, pointsDecimals));
      latestUserTokenBal = latestUserTokenBal.add(newExpected);

      expect(userTokenBalance).to.eq(latestUserTokenBal);
    });

    it("Should succesfully claim tokens after 12 months", async () => {
      const month12TokenId = thirdTokenId;
      // Move extra 6-months ahead from previous timeTravel
      await timeTravel(fixtureItems.day * 180 + 1);

      const expectedTokensPerBond = await pretokenbond.tokensPerUnit(slotsIdArray[2]);
      const unitsInToken = await pretokenbond.unitsInToken(month12TokenId);

      // Ensure 'user' is owner of token id, and that slot corresponds.
      expect(await pretokenbond.ownerOf(month12TokenId)).to.eq(user.address);
      expect(await pretokenbond.slotOf(month12TokenId)).to.eq(slotsIdArray[2]);

      // 'user' calls claim.
      await pretokenbond.connect(user).claim(month12TokenId);

      const userTokenBalance = await mocktoken.balanceOf(user.address);
      const newExpected = unitsInToken.mul(expectedTokensPerBond).div(parseUnits(1, pointsDecimals));
      latestUserTokenBal = latestUserTokenBal.add(newExpected);

      expect(userTokenBalance).to.eq(latestUserTokenBal);
    });
  });
});