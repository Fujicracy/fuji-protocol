const { ethers, waffle } = require("hardhat");
const { deployContract } = waffle;

const CHAINLINK_ORACLE_ADDR = "0x773616E4d11A78F511299002da57A0a94577F1f4";
const UNISWAP_ROUTER_ADDR = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const DAI_ADDR = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const ETH_ADDR = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const aWETH_ADDR = "0x030bA81f1c18d280636F32af80b9AAd02Cf0854e";
const cETH_ADDR = "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5";

const ONE_ETH = ethers.utils.parseEther("1.0");

const FLIQUIDATOR = require("../artifacts/contracts/Fliquidator.sol/Fliquidator.json")
const VaultETHDAI = require("../artifacts/contracts/VaultETHDAI.sol/VaultETHDAI.json");
const AAVE = require("../artifacts/contracts/ProviderAave.sol/ProviderAave.json");
const Compound = require("../artifacts/contracts/ProviderCompound.sol/ProviderCompound.json");
const DYDX = require("../artifacts/contracts/ProviderDYDX.sol/ProviderDYDX.json")
const DebtToken = require("../artifacts/contracts/DebtToken.sol/DebtToken.json");
const Flasher = require("../artifacts/contracts/flashloans/Flasher.sol/Flasher.json");
const Controller = require("../artifacts/contracts/Controller.sol/Controller.json");

const fixture = async ([wallet, other], provider) => {

  const dai = await ethers.getContractAt("IERC20", DAI_ADDR);
  const aweth = await ethers.getContractAt("IERC20", aWETH_ADDR);
  const ceth = await ethers.getContractAt("CErc20", cETH_ADDR);

  const fliquidator = await deployContract(wallet, FLIQUIDATOR, [UNISWAP_ROUTER_ADDR]);
  const flasher = await deployContract(wallet, Flasher, []);
  const controller = await deployContract(wallet, Controller, [flasher.address, fliquidator.address,"0"]);//changeThreshold percentagedecimal to ray (0.02 x 10^27)
  const aave = await deployContract(wallet, AAVE, []);
  const compound = await deployContract(wallet, Compound, []);
  const dydx = await deployContract(wallet, DYDX, []);
  const vault = await deployContract(wallet, VaultETHDAI, [controller.address,fliquidator.address,CHAINLINK_ORACLE_ADDR]);
  const debtToken = await deployContract(wallet, DebtToken, [vault.address,DAI_ADDR,"Fuji DAI debt token","fjDAI"]);

  await flasher.setController(controller.address);
  await flasher.setVaultAuthorization(vault.address, true);
  await vault.setDebtToken(debtToken.address);
  await vault.setFlasher(flasher.address);
  await vault.addProvider(aave.address);
  await vault.addProvider(compound.address);
  await vault.addProvider(dydx.address);
  await controller.addVault(vault.address);

  return {
    dai,
    aweth,
    ceth,
    fliquidator,
    flasher,
    controller,
    aave,
    compound,
    dydx,
    vault,
    debtToken
  }
}

const timeTravel = async (seconds) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
}

const convertToCurrencyDecimals = async (tokenAddr, amount) => {
  const token = await ethers.getContractAt("IERC20Detailed", tokenAddr);
  let decimals = (await token.decimals()).toString();

  return ethers.utils.parseUnits(`${amount}`, decimals);
};

const convertToWei = (amount) => ethers.utils.parseUnits(`${amount}`, 18);

const evmSnapshot = async () => await ethers.provider.send('evm_snapshot', []);
const evmRevert = async (id) => ethers.provider.send('evm_revert', [id]);

module.exports = {
  fixture,
  timeTravel,
  convertToCurrencyDecimals,
  convertToWei,
  DAI_ADDR,
  ONE_ETH,
  evmSnapshot,
  evmRevert,
}
