const { ethers } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");

const { BigNumber, provider } = ethers;

const { fixture, ASSETS, VAULTS } = require("../utils");
const {
  parseUnits,
  formatUnitsToNum,
  evmSnapshot,
  evmRevert,
  timeTravel,
} = require("../../helpers");

describe("NFT Bond Logic", function () {
  before(async function () {
    this.users = await ethers.getSigners();

    this.owner = this.users[0];
    this.user = this.users[2];

    const loadFixture = createFixtureLoader(this.users, provider);
    this.f = await loadFixture(fixture);

    this.pointsDecimals = await this.f.nftgame.POINTS_DECIMALS();
    this.sec = 60 * 60 * 24;

    this.evmSnapshot0 = await evmSnapshot();
  });

  beforeEach(async function () {
    if (this.evmSnapshot1) await evmRevert(this.evmSnapshot1);

    this.evmSnapshot1 = await evmSnapshot();
  });

  after(async function () {
    evmRevert(this.evmSnapshot0);
  });

  describe("Valid Vaults", function () {
    it("Set single valid vault", async function () {
      await expect(this.f.nftgame.validVaults(0)).to.be.reverted;
      await this.f.nftgame.setValidVaults([this.f.vaultftmdai.address]);
      expect(await this.f.nftgame.validVaults(0)).to.be.equal(this.f.vaultftmdai.address);
    });

    it("Set multiple valid vaults", async function () {
      await expect(this.f.nftgame.validVaults(0)).to.be.reverted;
      await this.f.nftgame.setValidVaults(VAULTS.map((v) => this.f[v.name].address));
      for (let i = 0; i < VAULTS.length; i++) {
        expect(await this.f.nftgame.validVaults(i)).to.be.equal(this.f[VAULTS[i].name].address);
      }
    });
  });

  describe("User Debt", function () {
    before(async function () {
      await evmRevert(this.evmSnapshot0);
      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.geist.address);
      }
      await this.f.nftgame.setValidVaults(VAULTS.map((v) => this.f[v.name].address));
    });

    it("No Deposits", async function () {
      expect(await this.f.nftgame.getUserDebt(this.user.address)).to.be.equal(0);
    });

    it("Single Valid Vault Deposit", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(1000);
      const borrowAmount = parseUnits(100);

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      expect(await this.f.nftgame.getUserDebt(this.user.address)).to.be.equal(
        formatUnitsToNum(borrowAmount)
      );
    });

    it("Single Invalid Vault Deposit", async function () {
      const vault = this.f.vaultftmdai;
      const validVault = this.f.vaultftmusdc;
      const depositAmount = parseUnits(1000);
      const borrowAmount = parseUnits(100);

      expect(vault).to.not.be.equal(validVault);

      await this.f.nftgame.setValidVaults([validVault.address]);

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      expect(await this.f.nftgame.getUserDebt(this.user.address)).to.be.equal(0);
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

      expect(await this.f.nftgame.getUserDebt(this.user.address)).to.be.equal(borrowSum);
    });

    it("Interest", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(5000);
      const borrowAmount = parseUnits(200);
      const time = 60 * 60 * 24 * 365; // 1 year

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      await timeTravel(time);
      await vault.updateF1155Balances();

      expect(await this.f.nftgame.getUserDebt(this.user.address)).to.be.gt(
        formatUnitsToNum(borrowAmount)
      );
    });
  });

  describe("Point System", function () {
    beforeEach(async function () {
      await evmRevert(this.evmSnapshot0);
      for (let i = 0; i < VAULTS.length; i += 1) {
        const vault = VAULTS[i];
        await this.f[vault.name].setActiveProvider(this.f.geist.address);
      }
      await this.f.nftgame.setValidVaults(VAULTS.map((v) => this.f[v.name].address));

      const now = (await provider.getBlock("latest")).timestamp;
      const week = 60 * 60 * 24 * 7;
      const phases = [now, now + 100 * week, now + 200 * week, now + 300 * week];

      await this.f.nftgame.setGamePhases(phases);
    });

    it("Rate of accrual", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(1000);
      const borrowAmount = parseUnits(100);

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      const pps = (formatUnitsToNum(borrowAmount) / this.sec) * 10 ** this.pointsDecimals;

      expect(await this.f.nftgame.computeRateOfAccrual(this.user.address)).to.be.equal(
        Math.floor(pps)
      );
    });

    it("New user starting points", async function () {
      expect(await this.f.nftgame.balanceOf(this.user.address, 0)).to.be.equal(0);
    });

    it("Awarding points to users", async function () {
      const users = [this.user.address, this.users[3].address];
      const amounts = [10000, 20000];

      for (let i = 0; i < users.length; i++) {
        expect(await this.f.nftgame.balanceOf(users[i], 0)).to.be.equal(0);
      }

      await this.f.nftgame.awardPoints(users, amounts);

      for (let i = 0; i < users.length; i++) {
        expect(await this.f.nftgame.balanceOf(users[i], 0)).to.be.equal(amounts[i]);
      }
    });

    it("Get points balance after time passed", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = parseUnits(2500);
      const borrowAmount = parseUnits(250);
      const time = 60 * 60 * 24 * 30; // 1 month in seconds
      const daySeconds = 60 * 60 * 24; // 1 day in seconds

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      const pps = await this.f.nftgame.computeRateOfAccrual(this.user.address);

      await timeTravel(time);
      await vault.updateF1155Balances();

      const pointsFromRate = pps.mul(time + 2);

      const newDebt = await this.f.nftgame.getUserDebt(this.user.address);
      const pointsFromInterest = newDebt
        .sub(formatUnitsToNum(borrowAmount))
        .mul(time + 2 + daySeconds)
        .div(2);

      const totalPoints = pointsFromRate.add(pointsFromInterest) / 1;
      const finalBalance = (await this.f.nftgame.balanceOf(this.user.address, 0)) / 1;
      expect(finalBalance).to.be.closeTo(totalPoints, totalPoints * 0.01);
    });

    it("Points balance, multiple borrows", async function () {
      const vault = this.f.vaultftmdai;
      const depositAmount = [parseUnits(2500), parseUnits(500)];
      const borrowAmount = [parseUnits(250), parseUnits(50)];
      const time = 60 * 60 * 24 * 30; // 1 month
      const daySeconds = 60 * 60 * 24; // 1 day in seconds

      let pps;
      let pointsFromRate = BigNumber.from(0);
      let newDebt;
      let pointsFromInterest = BigNumber.from(0);
      let recordedDebt;

      for (let i = 0; i < borrowAmount.length; i++) {
        await vault.connect(this.user).depositAndBorrow(depositAmount[i], borrowAmount[i], {
          value: depositAmount[i],
        });

        recordedDebt = await this.f.nftgame.getUserDebt(this.user.address);
        pps = await this.f.nftgame.computeRateOfAccrual(this.user.address);

        await timeTravel(time);
        await vault.updateF1155Balances();

        pointsFromRate = pointsFromRate.add(pps.mul(time + 2));

        newDebt = await this.f.nftgame.getUserDebt(this.user.address);
        pointsFromInterest = pointsFromInterest.add(
          newDebt
            .sub(recordedDebt)
            .mul(time + 2 + daySeconds)
            .div(2)
        );
      }

      const totalPoints = pointsFromRate.add(pointsFromInterest) / 1;
      const finalBalance = (await this.f.nftgame.balanceOf(this.user.address, 0)) / 1;
      expect(finalBalance).to.be.closeTo(totalPoints, totalPoints * 0.01);
    });

    it("Points balance, borrow and payback", async function () {
      const vault = this.f.vaultftmdai;
      const borrowAsset = "dai";
      const depositAmount = parseUnits(2500);
      const borrowAmount = parseUnits(250);
      const paybackAmount = parseUnits(100);
      const time = 60 * 60 * 24 * 30; // 1 month
      const daySeconds = 60 * 60 * 24; // 1 day in seconds

      await vault.connect(this.user).depositAndBorrow(depositAmount, borrowAmount, {
        value: depositAmount,
      });

      let pps = await this.f.nftgame.computeRateOfAccrual(this.user.address);

      await timeTravel(time);
      await this.f.vaultftmdai.updateF1155Balances();

      let pointsFromRate = pps.mul(time);

      let newDebt = await this.f.nftgame.getUserDebt(this.user.address);
      let pointsFromInterest = newDebt
        .sub(formatUnitsToNum(borrowAmount))
        .mul(time + 2 + daySeconds)
        .div(2);

      await this.f[borrowAsset].connect(this.user).approve(vault.address, paybackAmount);

      await vault.connect(this.user).payback(paybackAmount, {
        value: paybackAmount,
      });

      pps = await this.f.nftgame.computeRateOfAccrual(this.user.address);

      await timeTravel(time);
      await vault.updateF1155Balances();

      pointsFromRate = pointsFromRate.add(pps.mul(time));

      newDebt = await this.f.nftgame.getUserDebt(this.user.address);
      pointsFromInterest = newDebt
        .sub(BigNumber.from(formatUnitsToNum(borrowAmount)).sub(formatUnitsToNum(paybackAmount)))
        .mul(time + 2 + daySeconds)
        .div(2);

      const totalPoints = pointsFromRate.add(pointsFromInterest) / 1;
      const finalBalance = (await this.f.nftgame.balanceOf(this.user.address, 0)) / 1;
      expect(finalBalance).to.be.closeTo(totalPoints, totalPoints * 0.01);
    });
  });
});
