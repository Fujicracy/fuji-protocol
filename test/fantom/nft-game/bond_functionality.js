const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { WrapperBuilder } = require("redstone-evm-connector");

const { BigNumber, provider } = ethers;

const { fixture } = require("../utils");

const { ZERO_ADDR } = require("./../../helpers.js")

const { quickFixture, ASSETS, VAULTS } = require("./quick_test_fixture");

const {
  parseUnits,
  formatUnitsToNum,
  evmSnapshot,
  evmRevert,
  evmSetNextBlockTimestamp,
  timeTravel,
} = require("../../helpers");

const FULL_FIXTURE = false;
const DEBUG = true;

if (FULL_FIXTURE) {
  const { ASSETS, VAULTS } = require("../utils");
} else {
  const { ASSETS, VAULTS } = require("./quick_test_fixture");
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const amountOfCratesToBuy = 10;

/// ERC3525 Glossary

// A 'slot' is a container-type. In FujiBonds: a 'slot' is a specific vesting schedule.
// A token Id is a unique container of type 'slot'. In FujiBonds: a token Id is container of bonds.
// All token Ids with the same slot are compatible. They have the same vesting schedule.
// Units of a token Id are the bonds. Each bond unit, depending on slot, is redeemable for Fuji tokens.


describe("Bond Functionality", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.admin = this.users[0];
    this.user = this.users[1];
    this.otherUser = this.users[2];
    this.operator = this.users[3];

    const loadFixture = createFixtureLoader(this.users, provider);

    if (FULL_FIXTURE) {
      this.f = await loadFixture(fixture);
    } else {
      this.f = await loadFixture(quickFixture);
    }

    /// Specific testing conditions.

    // Move to accumulation phase.
    const now = (await provider.getBlock("latest")).timestamp;
    const quicktimeGap = 2; // 2 seconds
    const day = 60 * 60 * 24;
    const phases = [
      now,
      now + quicktimeGap,
      now + day,
      now + day
    ];
    await this.f.nftgame.setGamePhases(phases);

    // Force mint points for 'user'
    await this.f.nftgame.mint(this.user.address, 0, parseUnits(200, 5));

    // Mint All cardIDs for 'user'
    const cardIds = this.f.cardIds;
    for (let index = cardIds[0]; index <= cardIds[1]; index++) {
      await this.f.nftgame.mint(index, this.user.address);
    }

    // This condition is for testing only, allowing time travel and using redstone entropy feed.
    await this.f.nftinteractions.setMaxEntropyDelay(60 * 60 * 24 * 365 * 2);

    // Move to trading phase.
    await timeTravel(day);

    await this.f.nftinteractions.connect(this.user).lockFinalScore();

    // Deploy pretokenbond
    const PreTokenBond = ethers.getContractFactory("PreTokenBond");
    this.pretokenbond = await upgrades.deployProxy(
      PreTokenBond,
      [
        // QUESTION: what will be the initializer params to be added here.
        //initializer functions
      ],
      { kind: 'uups' }
    );
    this.evmSnapshot0 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("Basic Bond ERC721 Functionality", function () {

    before(async function () {
      // Admin force mint bonds of each slot for user
      const slotsIdArray; // QUESTION: Check how we will fetch the slots ids that exists.
      this.numberOfEachBondTypeToBuy = 5;

      // QUESTION: Check what method can be used for vouchers/token ids to be minted by admin.
      for (let index = 0; index < slotsIdArray.length; index++) {
        await this.pretokenbond.mint(this.user.address, slotsArray[index], this.numberOfEachBondTypeToBuy);
      }
    });

    after(async function () {
      evmRevert(this.evmSnapshot0);
    });

    it("Return value when calling 'balanceOf'", async function () {
      const bal;
      for (let index = 0; index < slotsIdArray.length; index++) {
        bal = await this.pretokenbond.balanceOf(this.user.address, index + 1);
        expect(bal).to.be.gt(0);
      }
    });

    it("Revert when calling 'balanceOf' address 0", async function () {
      await expect(this.pretokenbond.balanceOf(ZERO_ADDR, 1)).to.be.reverted;
    });

    it("Returns owner of token ID when calling 'ownerOf'", async function () {
      const owner = await this.pretokenbond.ownerOf(1);
      expect(owner).to.eq(this.user.address);
    });

    it("Succesfully transfer tokenID", async function () {
      await this.pretokenbond.connect(this.user).transferFrom(this.user.address, this.otherUser.address, 1);
      const balOtherUser = this.pretokenbond.balanceOf(this.otherUser.address, 1);
      expect(balOtherUser).to.eq(1);
    });

    it("Returns the account approved for `tokenId`", async function () {
      const tokenID = 11;
      expect(tokenID).to.be.lte(this.numberOfEachBondTypeToBuy * 3); // Check that tokenID is in range.
      await this.pretokenbond.connect(this.user).approve(this.otherUser.address, tokenID);
      const approvedUser = await this.pretokenbond.getApproved(tokenID);
      expect(approvedUser).to.eq(this.otherUser.address);
    });

    it("Succesfully transfer the approved `tokenId`", async function () {
      const tokenID = 11; // This tokenID must be the same as in previous test. 
      await this.pretokenbond.connect(this.otherUser).transferFrom(this.user.address, this.otherUser.address, tokenID);
      const owner = await this.pretokenbond.ownerOf(tokenID);
      expect(owner).to.eq(this.otherUser.address);
    });

    it("Succesfully approve `operator` and performs transfer", async function () {
      const tokenID = 12;
      expect(tokenID).to.be.lte(this.numberOfEachBondTypeToBuy * 3); // Check that tokenID is in range.
      await this.pretokenbond.connect(this.user).setApprovalForAll(this.operator.address, true);
      await this.pretokenbond.connect(this.operator).transferFrom(this.user.address, this.otherUser.address, tokenID);
      const owner = await this.pretokenbond.ownerOf(tokenID);
      expect(owner).to.eq(this.otherUser.address);
    });

    it("Succesfully remove `operator` and reverts when trying transfer", async function () {
      const tokenID = 13;
      expect(tokenID).to.be.lte(this.numberOfEachBondTypeToBuy * 3); // Check that tokenID is in range.
      await this.pretokenbond.connect(this.user).setApprovalForAll(this.operator.address, false);
      await expect(
        this.pretokenbond.connect(this.operator).transferFrom(this.user.address, this.otherUser.address, tokenID)
      ).to.be.reverted;
    });
  });

  describe("Basic Bond ERC3525 Functionality", function () {

    before(async function () {
      const slotsIdArray; // QUESTION: Check how we will fetch the slots ids that exists.
      // Admin force mint bonds of each slot for user
      this.numberOfEachBondTypeToBuy = 5;

      // QUESTION: Check what method can be used for vouchers/token ids to be minted by admin.
      for (let index = 0; index < slotsIdArray.length; index++) {
        await this.pretokenbond.mint(this.user.address, slotsArray[index], numberOfEachBondTypeToBuy);
      }
    });

    after(async function () {
      evmRevert(this.evmSnapshot0);
    });

    it("Returns a 'slot' value for each token Id", async function () {
      // Find the slot of a tokenID 'slotOf(uint256 _tokenId)'
      for (let index = 0; index < array.length; index++) {
        const element = array[index];
        
      }

    });

    it("Returns a value for the supply of a 'slot'", async function () {
      // Count all # of tokens holding the same slot. 'supplyOfSlot(uint256 _slot)'

    });

    it("Returns decimals of the units of a token Id ", async function () {
      // Number of decimals a token uses for units 'unitDecimals()'

    });

    it("Returns token Id when calling slot and index", async function () {
      // The id for the `_index`th token in the token list of the slot 'tokenOfSlotByIndex(uint256 _slot, uint256 _index)'

    });

    it("Should return zero units when token Id is called before token allocation to bonds", async function () {
      // The amount of units of `_tokenId` 'unitsInToken(uint256 _tokenId)'

    });

    it("Should return value units when called after token allocation to bonds", async function () {
      // The amount of units of `_tokenId` 'unitsInToken(uint256 _tokenId)'

    });

    it("Should approve and transfer succesfully 'units' of token Id to another token Id of the same slot", async function () {
      // approve(address _to, uint256 _tokenId, uint256 _units), allowance(uint256 _tokenId, address _spender)

    });

    it("Should split token Id by units and share the same slot", async function () {
      // Split a token into several by separating its units and assigning each portion to a new created token.
    });

    it("Should merge token Ids of the same slot", async function () {
      // Merge several tokens into one by merging their units into a target token before burning them.

    });

    it("Should transfer 'units' of token Id to new token Id", async function () {
      // transferFrom(address _from, address _to, uint256 _tokenId, uint256 _units)

    });

    it("Should transfer 'units' of token Id to another token Id of the same slot", async function () {
      // transferFrom(address _from, address _to, uint256 _tokenId, uint256 _targetTokenId, uint256 _units) external;

    });

  });

  describe("Fuji Bond Specific Functionality", function () {

    after(async function () {
      evmRevert(this.evmSnapshot0);
    });

    it("Should return a value for price of mining a token ID", async function () {

    });

    it("Should return value for the vesting time for different 'slots'", async function () {

    });

    it("Should allow to mint a token ID with zero units before end of bond phase", async function () {

    });

    it("Should revert if try to mint a token Id after bond phase", async function () {

    });


  });


});