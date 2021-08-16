const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { fixture, evmSnapshot, evmRevert, ZERO_ADDR } = require("./utils-alpha");

describe("Alpha", () => {
  let aave;
  let compound;
  let dydx;
  let controller;
  let vaultdai;
  let vaultusdc;
  let users;
  let owner;
  let newOwner;
  let user;
  let loadFixture;
  let evmSnapshotId;

  before(async () => {
    users = await ethers.getSigners();
    owner = users[0];
    newOwner = users[1];
    user = users[2];
    loadFixture = createFixtureLoader(users, ethers.provider);
    evmSnapshotId = await evmSnapshot();
  });

  after(async () => {
    evmRevert(evmSnapshotId);
  });

  beforeEach(async () => {
    const theFixture = await loadFixture(fixture);
    aave = theFixture.aave;
    compound = theFixture.compound;
    dydx = theFixture.dydx;
    controller = theFixture.controller;
    vaultdai = theFixture.vaultdai;
    vaultusdc = theFixture.vaultusdc;
  });

  describe("Alpha Controller Functionality", () => {
    it("1.- Try Refinance VaultDai with Aave flashloan", async () => {
      // Testing Vault
      const theVault = vaultdai;
      const preStagedProvider = dydx;
      const destinationProvider = compound;
      const flashloanprovider = 0; // Flashloan Providers: Aave = 0, dYdX = 1, CreamFinance = 2
      // IMPORTANT! If preStagedProvider or destinationProvider = dydx, flashloan provider cannot be dYdX

      // Set defined ActiveProviders
      await theVault.setActiveProvider(preStagedProvider.address);

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await theVault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Users deposit and borrow
      const userX = users[2];
      const depositX = ethers.utils.parseEther("10");
      const borrowX = ethers.utils.parseUnits("3000", 18);
      const userY = users[3];
      const depositY = ethers.utils.parseEther("5");
      const borrowY = ethers.utils.parseUnits("2500", 18);
      const userW = users[4];
      const depositW = ethers.utils.parseEther("5");
      const borrowW = ethers.utils.parseUnits("2300", 18);

      await theVault.connect(userX).depositAndBorrow(depositX, borrowX, { value: depositX });
      await theVault.connect(userY).depositAndBorrow(depositY, borrowY, { value: depositY });
      await theVault.connect(userW).depositAndBorrow(depositW, borrowW, { value: depositW });

      const priorRefinanceVaultDebt = await theVault.borrowBalance(preStagedProvider.address);
      const priorRefinanceVaultCollat = await theVault.depositBalance(preStagedProvider.address);
      // console.log(priorRefinanceVaultDebt/1,priorRefinanceVaultCollat/1);

      await controller
        .connect(users[0])
        .doRefinancing(theVault.address, destinationProvider.address, 1, 1, flashloanprovider);

      const afterRefinanceVaultDebt = await theVault.borrowBalance(destinationProvider.address);
      const afterRefinanceVaultCollat = await theVault.depositBalance(destinationProvider.address);

      // Visual Check
      // console.log(afterRefinanceVaultDebt/1, afterRefinanceVaultCollat/1);

      let refinanceVaultDebtPlusFees;

      if (flashloanprovider === 0) {
        refinanceVaultDebtPlusFees = priorRefinanceVaultDebt * 1.0009;
        await expect(refinanceVaultDebtPlusFees / 1).to.be.closeTo(
          afterRefinanceVaultDebt / 1,
          1e15
        );
      } else if (flashloanprovider === 2) {
        refinanceVaultDebtPlusFees = priorRefinanceVaultDebt * 1.0003;
        await expect(refinanceVaultDebtPlusFees / 1).to.be.closeTo(
          afterRefinanceVaultDebt / 1,
          1e15
        );
      } else {
        await expect(priorRefinanceVaultDebt / 1).to.be.closeTo(afterRefinanceVaultDebt / 1, 1e15);
      }

      await expect(priorRefinanceVaultCollat / 1).to.be.closeTo(
        afterRefinanceVaultCollat / 1,
        1e15
      );
    });

    it("2.- Try Refinance VaultDai with dYdX flashloan", async () => {
      // Testing Vault
      const theVault = vaultdai;
      const preStagedProvider = aave;
      const destinationProvider = compound;
      const flashloanprovider = 1; // Flashloan Providers: Aave = 0, dYdX = 1, CreamFinance = 2
      // IMPORTANT! If preStagedProvider or destinationProvider = dydx, flashloan provider cannot be dYdX

      // Set defined ActiveProviders
      await theVault.setActiveProvider(preStagedProvider.address);

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await theVault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Users deposit and borrow
      const userX = users[2];
      const depositX = ethers.utils.parseEther("10");
      const borrowX = ethers.utils.parseUnits("3000", 18);
      const userY = users[3];
      const depositY = ethers.utils.parseEther("5");
      const borrowY = ethers.utils.parseUnits("2500", 18);
      const userW = users[4];
      const depositW = ethers.utils.parseEther("5");
      const borrowW = ethers.utils.parseUnits("2300", 18);

      await theVault.connect(userX).depositAndBorrow(depositX, borrowX, { value: depositX });
      await theVault.connect(userY).depositAndBorrow(depositY, borrowY, { value: depositY });
      await theVault.connect(userW).depositAndBorrow(depositW, borrowW, { value: depositW });

      const priorRefinanceVaultDebt = await theVault.borrowBalance(preStagedProvider.address);
      const priorRefinanceVaultCollat = await theVault.depositBalance(preStagedProvider.address);
      // console.log(priorRefinanceVaultDebt/1,priorRefinanceVaultCollat/1);

      await controller
        .connect(users[0])
        .doRefinancing(theVault.address, destinationProvider.address, 1, 1, flashloanprovider);

      const afterRefinanceVaultDebt = await theVault.borrowBalance(destinationProvider.address);
      const afterRefinanceVaultCollat = await theVault.depositBalance(destinationProvider.address);

      // Visual Check
      // console.log(afterRefinanceVaultDebt/1, afterRefinanceVaultCollat/1);

      let refinanceVaultDebtPlusFees;

      if (flashloanprovider === 0) {
        refinanceVaultDebtPlusFees = priorRefinanceVaultDebt * 1.0009;
        await expect(refinanceVaultDebtPlusFees / 1).to.be.closeTo(
          afterRefinanceVaultDebt / 1,
          1e15
        );
      } else if (flashloanprovider === 2) {
        refinanceVaultDebtPlusFees = priorRefinanceVaultDebt * 1.0003;
        await expect(refinanceVaultDebtPlusFees / 1).to.be.closeTo(
          afterRefinanceVaultDebt / 1,
          1e15
        );
      } else {
        await expect(priorRefinanceVaultDebt / 1).to.be.closeTo(afterRefinanceVaultDebt / 1, 1e15);
      }

      await expect(priorRefinanceVaultCollat / 1).to.be.closeTo(
        afterRefinanceVaultCollat / 1,
        1e15
      );
    });

    it("3.- Try Refinance vaultusdc with CreamFlashLoans", async () => {
      // Testing Vault
      const theVault = vaultusdc;
      const preStagedProvider = dydx;
      const destinationProvider = compound;
      const flashloanprovider = 2; // Flashloan Providers: Aave = 0, dYdX = 1, CreamFinance = 2
      // IMPORTANT! If preStagedProvider or destinationProvider = dydx, flashloan provider cannot be dYdX

      // Set defined ActiveProviders
      await theVault.setActiveProvider(preStagedProvider.address);

      // Bootstrap Liquidity
      const bootstraper = users[0];
      const bstrapLiquidity = ethers.utils.parseEther("1");
      await theVault.connect(bootstraper).deposit(bstrapLiquidity, { value: bstrapLiquidity });

      // Users deposit and borrow
      const userX = users[2];
      const depositX = ethers.utils.parseEther("10");
      const borrowX = ethers.utils.parseUnits("3000", 6);
      const userY = users[3];
      const depositY = ethers.utils.parseEther("5");
      const borrowY = ethers.utils.parseUnits("2500", 6);
      const userW = users[4];
      const depositW = ethers.utils.parseEther("5");
      const borrowW = ethers.utils.parseUnits("2300", 6);

      await theVault.connect(userX).depositAndBorrow(depositX, borrowX, { value: depositX });
      await theVault.connect(userY).depositAndBorrow(depositY, borrowY, { value: depositY });
      await theVault.connect(userW).depositAndBorrow(depositW, borrowW, { value: depositW });

      const priorRefinanceVaultDebt = await theVault.borrowBalance(preStagedProvider.address);
      const priorRefinanceVaultCollat = await theVault.depositBalance(preStagedProvider.address);
      // console.log(priorRefinanceVaultDebt/1,priorRefinanceVaultCollat/1);

      await controller
        .connect(users[0])
        .doRefinancing(theVault.address, destinationProvider.address, 1, 1, flashloanprovider);

      const afterRefinanceVaultDebt = await theVault.borrowBalance(destinationProvider.address);
      const afterRefinanceVaultCollat = await theVault.depositBalance(destinationProvider.address);

      // Visual Check
      // console.log(afterRefinanceVaultDebt/1, afterRefinanceVaultCollat/1);
      let refinanceVaultDebtPlusFees;

      if (flashloanprovider === 0) {
        refinanceVaultDebtPlusFees = priorRefinanceVaultDebt * 1.0009;
        await expect(refinanceVaultDebtPlusFees / 1).to.be.closeTo(
          afterRefinanceVaultDebt / 1,
          1e15
        );
      } else if (flashloanprovider === 2) {
        refinanceVaultDebtPlusFees = priorRefinanceVaultDebt * 1.0003;
        await expect(refinanceVaultDebtPlusFees / 1).to.be.closeTo(
          afterRefinanceVaultDebt / 1,
          1e15
        );
      } else {
        await expect(priorRefinanceVaultDebt / 1).to.be.closeTo(afterRefinanceVaultDebt / 1, 1e15);
      }

      await expect(priorRefinanceVaultCollat / 1).to.be.closeTo(
        afterRefinanceVaultCollat / 1,
        1e15
      );
    });

    describe("Testing ownership transfer", () => {
      it("Revert: User tricks to have ownership of the contract", async () => {
        await expect(controller.connect(user).transferOwnership(user.address)).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Success: Owner tries to transfer ownership to new Owner", async () => {
        expect(await controller.pendingOwner()).to.be.equal(ZERO_ADDR);

        await controller.connect(owner).transferOwnership(newOwner.address);

        expect(await controller.pendingOwner()).to.be.equal(newOwner.address);

        await expect(controller.connect(owner).transferOwnership(newOwner.address)).to.be.reverted;
      });

      it("Revert: User tries to claim ownership", async () => {
        await expect(controller.connect(user).claimOwnership()).to.be.reverted;
      });

      it("Success: New owner tries to claim ownership", async () => {
        await controller.connect(owner).transferOwnership(newOwner.address);

        expect(await controller.pendingOwner()).to.be.equal(newOwner.address);
        expect(await controller.owner()).to.be.equal(owner.address);

        await controller.connect(newOwner).claimOwnership();

        expect(await controller.pendingOwner()).to.be.equal(ZERO_ADDR);
        expect(await controller.owner()).to.be.equal(newOwner.address);
      });

      it("Revert: user tries to call cancelTransferOwnership", async () => {
        await expect(controller.connect(user).cancelTransferOwnership()).to.be.revertedWith(
          "Ownable: caller is not the owner"
        );
      });

      it("Revert: New owner tries to call cancelTransferOwnership before calling transferOwnership", async () => {
        await expect(controller.connect(owner).cancelTransferOwnership()).to.be.reverted;
      });

      it("Success: New owner tries to call cancelTransferOwnership after calling transferOwnership", async () => {
        expect(await controller.pendingOwner()).to.be.equal(ZERO_ADDR);

        await controller.connect(owner).transferOwnership(newOwner.address);

        expect(await controller.pendingOwner()).to.be.equal(newOwner.address);

        await controller.connect(owner).cancelTransferOwnership();

        expect(await controller.pendingOwner()).to.be.equal(ZERO_ADDR);
      });
    });
  });
});
