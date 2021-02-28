const { ethers } = require("hardhat");
const { expect } = require("chai");
const { solidity, createFixtureLoader } = require("ethereum-waffle");

const {
  fixture,
  convertToCurrencyDecimals,
  convertToWei,
  DAI_ADDR,
  ONE_ETH,
} = require("./utils.js");

//use(solidity);

describe("Fuji", () => {
  let controller;
  let flasher;
  let vault;
  let aave;
  let compound;

  let dai;
  let aweth;
  let ceth;
  let debtToken;
  let users;

  let loadFixture;

  before(async() => {
    users = await ethers.getSigners();
    loadFixture = createFixtureLoader(users, ethers.provider);

    // unlock DAI so that we can make initial transfer
    //await hre.network.provider.request({
      //method: "hardhat_impersonateAccount",
      //params: [DAI_ADDR]
    //});
  });

  describe("VaultETHDAI -> Aave", () => {

    it("User 1 deposits 1 ETH and borrows 900 DAI", async () => {
      const { dai, vault, aweth, debtToken } = await loadFixture(fixture);

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });

      // Vault balance
      expect(await aweth.balanceOf(vault.address)).to.equal(ONE_ETH);

      const daiAmount = await convertToCurrencyDecimals(DAI_ADDR, 400);

      await expect(() => vault.connect(users[1]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[1], daiAmount);

      expect(await debtToken.balanceOf(users[1].address)).to.equal(daiAmount);

      // debt tokens appreciate after another tx
      const newDaiAmount = await convertToCurrencyDecimals(DAI_ADDR, 500);
      await vault.connect(users[1]).borrow(newDaiAmount);
      const balance = await debtToken.balanceOf(users[1].address);
      //console.log(balance.toString());
      expect(balance).to.gt(daiAmount);
    });

    it("User 2 deposits 1 ETH and borrows 900 DAI", async () => {
      const { dai, vault, debtToken } = await loadFixture(fixture);

      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      await vault.connect(users[2]).deposit(ONE_ETH, { value: ONE_ETH });

      const daiAmount = await convertToCurrencyDecimals(DAI_ADDR, 900);
      await expect(() => vault.connect(users[1]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[1], daiAmount);
      await expect(() => vault.connect(users[2]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[2], daiAmount);

      const balance1 = await debtToken.balanceOf(users[1].address);
      console.log("User 1 debt balance: " + balance1.toString());
      const balance2 = await debtToken.balanceOf(users[2].address);
      console.log("User 2 debt balance: " + balance2.toString());

      // user1 accumulates more debt than user2
      expect(balance1).to.gt(balance2);
    });

    it("User 4 deposits 1 ETH, borrows 1000 DAI and flash-close", async () => {
      const { dai, vault, debtToken } = await loadFixture(fixture);
      await vault.connect(users[4]).deposit(ONE_ETH, { value: ONE_ETH });

      const daiAmount = await convertToCurrencyDecimals(DAI_ADDR, 700);

      await expect(() => vault.connect(users[4]).borrow(daiAmount))
        .to.changeTokenBalance(dai, users[4], daiAmount);

      expect(await debtToken.balanceOf(users[4].address)).to.equal(daiAmount);

      const balanceBefore = await ethers.provider.getBalance(users[4].address);
      await vault.connect(users[4]).flashCloseTotal();
      const balanceAfter = await ethers.provider.getBalance(users[4].address);

      expect(await dai.balanceOf(users[4].address)).to.equal(daiAmount);
      expect(balanceAfter).to.gt(balanceBefore);

      expect(await debtToken.balanceOf(users[4].address)).to.equal(0);

    });

  });

  //describe("Flashloan and Switch", () => {

    //it("Should initiate a flash loan", async () => {
      //const balance1 = await debtToken.balanceOf(users[1].address);
      //const balance2 = await debtToken.balanceOf(users[2].address);
      //console.log(balance1.add(balance2).toString());

      //await controller.doControllerRoutine(vault.address);
    //});

  //});

});

//const CHAINLINK_ORACLE_ADDR = "0x773616E4d11A78F511299002da57A0a94577F1f4";
//const UNISWAP_ROUTER_ADDR = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
//const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
//const DAI_ADDR = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
//const ETH_ADDR = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
//const aWETH_ADDR = "0x030bA81f1c18d280636F32af80b9AAd02Cf0854e";
//const cETH_ADDR = "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5";

  //it("Should deploy contracts", async () => {
    //const VaultETHDAI = await ethers.getContractFactory("VaultETHDAI");
    //const AAVE = await ethers.getContractFactory("ProviderAave");
    //const Compound = await ethers.getContractFactory("ProviderCompound");
    //const DebtToken = await ethers.getContractFactory("DebtToken");
    //const Flasher = await ethers.getContractFactory("Flasher");
    //const Controller = await ethers.getContractFactory("Controller");

    //dai = await ethers.getContractAt("IERC20", DAI_ADDR);
    //aweth = await ethers.getContractAt("IERC20", aWETH_ADDR);
    //ceth = await ethers.getContractAt("CErc20", cETH_ADDR);

    //flasher = await Flasher.deploy();
    //controller = await Controller.deploy(
      //flasher.address,
      //"0" //changeThreshold percentagedecimal to ray (0.02 x 10^27)
    //);

    //aave = await AAVE.deploy();
    //compound = await Compound.deploy();
    //vault = await VaultETHDAI.deploy(
      //controller.address,
      //CHAINLINK_ORACLE_ADDR,
      //UNISWAP_ROUTER_ADDR
    //);
    //debtToken = await DebtToken.deploy(
      //vault.address,
      //DAI_ADDR,
      //"Fuji DAI debt token",
      //"faDAI"
    //);

    //await flasher.setController(controller.address);
    //await flasher.setVaultAuthorization(vault.address, true);
    //await vault.setDebtToken(debtToken.address);
    //await vault.setFlasher(flasher.address);
    //await vault.addProvider(aave.address);
    //await vault.addProvider(compound.address);
    //await controller.addVault(vault.address);
  //});
