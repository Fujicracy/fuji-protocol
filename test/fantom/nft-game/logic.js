const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { getContractAt, provider } = ethers;

const { fixture, ASSETS, VAULTS } = require("../utils");
const {
  parseUnits,
  formatUnitsToNum,
  evmSnapshot,
  evmRevert,
  timeTravel,
} = require("../../helpers");

describe("Core Fuji Instance", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.owner = this.users[0];
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

  describe("NFT Bond Logic", function () {
    describe("Valid Vaults", function () {
      it("Set single valid vault", async function () {
        await expect(this.f.nftbond.validVaults(0)).to.be.reverted;
        await this.f.nftbond.setValidVaults([this.f.vaultftmdai.address]);
        expect(await this.f.nftbond.validVaults(0)).to.be.equal(this.f.vaultftmdai.address);
      });

      it("Set multiple valid vaults", async function () {
        await expect(this.f.nftbond.validVaults(0)).to.be.reverted;
        await this.f.nftbond.setValidVaults(VAULTS.map((v) => this.f[v.name].address));
        for (let i = 0; i < VAULTS.length; i++) {
          expect(await this.f.nftbond.validVaults(i)).to.be.equal(this.f[VAULTS[i].name].address);
        }
      });
    });

    describe("User Debt", function () {
      before(async function () {
        for (let i = 0; i < VAULTS.length; i += 1) {
          const vault = VAULTS[i];
          await this.f[vault.name].setActiveProvider(this.f.geist.address);
        }
        await this.f.nftbond.setValidVaults(VAULTS.map((v) => this.f[v.name].address));
      });

      it("No Deposits", async function () {
        expect(await this.f.nftbond.getUserDebt(this.user.address)).to.be.equal(0);
      });

      it("Single Valid Vault Deposit", async function () {
        const vault = this.f.vaultftmdai;
        const depositAmount = parseUnits(1000);
        const borrowAmount = parseUnits(100);

        await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
          value: depositAmount,
        });

        expect(await this.f.nftbond.getUserDebt(this.user.address)).to.be.equal(
          formatUnitsToNum(borrowAmount)
        );
      });

      it("Single Invalid Vault Deposit", async function () {
        const vault = this.f.vaultftmdai;
        const validVault = this.f.vaultftmusdc;
        const depositAmount = parseUnits(1000);
        const borrowAmount = parseUnits(100);

        expect(vault).to.not.be.equal(validVault);

        await this.f.nftbond.setValidVaults([validVault.address]);

        await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
          value: depositAmount,
        });

        expect(await this.f.nftbond.getUserDebt(this.user.address)).to.be.equal(0);
      });

      it("Multiple Vaults", async function () {
        const vaults = [this.f.vaultftmdai, this.f.vaultftmusdc];
        const depositAmounts = [parseUnits(100), parseUnits(200)];
        const borrowAmounts = [parseUnits(9), parseUnits(19, 6)];
        const borrowDecimals = [18, 6];

        let borrowSum = 0;
        for (let i = 0; i < vaults.length; i++) {
          await vaults[i].connect(this.user).depositAndBorrow(depositAmounts[i], borrowAmounts[i], {
            value: depositAmounts[i],
          });
          borrowSum += formatUnitsToNum(borrowAmounts[i], borrowDecimals[i]);
        }

        expect(await this.f.nftbond.getUserDebt(this.user.address)).to.be.equal(borrowSum);
      });

      it("Interest", async function () {
        const vaults = [this.f.vaultftmdai, this.f.vaultftmusdc];
        const depositAmounts = [parseUnits(5000), parseUnits(4000)];
        const borrowAmounts = [parseUnits(1500), parseUnits(1000, 6)];
        const borrowDecimals = [18, 6];

        let borrowSum = 0;
        for (let i = 0; i < vaults.length; i++) {
          await vaults[i].connect(this.user).depositAndBorrow(depositAmounts[i], borrowAmounts[i], {
            value: depositAmounts[i],
          });
          borrowSum += formatUnitsToNum(borrowAmounts[i], borrowDecimals[i]);
        }

        await timeTravel(99999999);

        expect(await this.f.nftbond.getUserDebt(this.user.address)).to.be.gt(borrowSum);
      });
    });

    describe("Point System", function () {
      before(async function () {
        for (let i = 0; i < VAULTS.length; i += 1) {
          const vault = VAULTS[i];
          await this.f[vault.name].setActiveProvider(this.f.geist.address);
        }
        await this.f.nftbond.setValidVaults(VAULTS.map((v) => this.f[v.name].address));
      });

      it("New user starting points", async function () {
        expect(await this.f.nftbond.balanceOf(this.user.address, 0)).to.be.equal(0);
      });

      it("Reverting state of points outside contract", async function () {
        await expect(this.f.nftbond.checkStateOfPoints(this.user.address, 0, true)).to.be.reverted;
      });

      it("Get points balance after time passed", async function () {
        const vault = this.f.vaultftmdai;
        const depositAmount = parseUnits(1000);
        const borrowAmount = parseUnits(100);
        const secsInADay = 60 * 60 * 24;
        const time = 60 * 60 * 24 * 365; // 1 year

        await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
          value: depositAmount,
        });

        await timeTravel(time);

        const pointsFromRate = time * (formatUnitsToNum(borrowAmount) / secsInADay);
        const pointsFromInterest =
          (((await this.f.nftbond.getUserDebt(this.user.address)) -
            formatUnitsToNum(borrowAmount)) *
            time) /
          2;

        expect(await this.f.nftbond.balanceOf(this.user.address, 0)).to.be.equal(
          pointsFromRate + pointsFromInterest
        );
      });
    });
  });
});
