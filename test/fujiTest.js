const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

const daiAddr = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const ethAddr = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const awethAddr = "0x030bA81f1c18d280636F32af80b9AAd02Cf0854e";
//const cethAddr

const ONE_ETH = ethers.utils.parseEther("1.0");
const ONE_UNIT = ethers.utils.parseUnits("1", 18);

describe("Fuji", () => {
  let vault;
  let aave;
  let compound;

  let dai;
  let aweth;
  let users;

  before(async() => {
    users = await ethers.getSigners();
  });

  //const convertToCurrencyDecimals = async (tokenAddr, amount) => {
    //const token = await ethers.getContractAt("IERC20Detailed", tokenAddr);
    //let decimals = (await token.decimals()).toString();

    //return ethers.utils.parseUnits(`${amount}`, decimals);
  //};

  const convertToWei = (amount) => ethers.utils.parseUnits(`${amount}`, 18);

  it("Should deploy contracts", async () => {
    const VaultETHDAI = await ethers.getContractFactory("VaultETHDAI");
    const AAVE = await ethers.getContractFactory("ProviderAave");
    const Compound = await ethers.getContractFactory("ProviderCompound");
    
    dai = await ethers.getContractAt("IERC20", daiAddr);
    aweth = await ethers.getContractAt("IERC20", awethAddr);

    aave = await AAVE.deploy();
    compound = await Compound.deploy();
    vault = await VaultETHDAI.deploy(
      users[0].address,
      "0x773616E4d11A78F511299002da57A0a94577F1f4",
      aave.address
    );
  });

  describe("VaultETHDAI -> Aave", () => {

    it("User deposits 1 ETH and borrows 900 DAI", async () => {
      await vault.connect(users[1]).deposit(ONE_ETH, { value: ONE_ETH });
      expect(await aweth.balanceOf(vault.address)).to.equal(ONE_UNIT);

      const daiAmount = convertToWei(900);
      await vault.connect(users[1]).borrow(daiAmount);
      expect(await dai.balanceOf(users[1].address)).to.equal(daiAmount);
    });

  });
});
