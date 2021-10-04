const { ethers } = require("hardhat");

const timeTravel = async (seconds) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
};

const advanceBlocks = async (blocks) => {
  for (let i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine");
  }
};

const parseUnits = (amount, decimals = 18) => ethers.utils.parseUnits(`${amount}`, decimals);
const parseUnitsOfCurrency = async (tokenAddr, amount) => {
  const token = await ethers.getContractAt("IERC20Extended", tokenAddr);
  const decimals = (await token.decimals()).toString();

  return ethers.utils.parseUnits(`${amount}`, decimals);
};

const formatUnitsToNum = (amount, decimals = 18) =>
  Number(ethers.utils.formatUnits(amount, decimals));
const formatUnitsOfCurrency = async (tokenAddr, amount) => {
  const token = await ethers.getContractAt("IERC20Extended", tokenAddr);
  const decimals = (await token.decimals()).toString();

  return ethers.utils.formatUnits(amount, decimals);
};

const toBN = (amount) => ethers.BigNumber.from(`${amount}`);

const evmSnapshot = async () => ethers.provider.send("evm_snapshot", []);
const evmRevert = async (id) => ethers.provider.send("evm_revert", [id]);

const FLASHLOAN = {
  AAVE: 0,
  DYDX: 1,
  CREAM: 2,
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

module.exports = {
  timeTravel,
  advanceBlocks,
  parseUnits,
  parseUnitsOfCurrency,
  formatUnitsToNum,
  formatUnitsOfCurrency,
  toBN,
  evmSnapshot,
  evmRevert,
  FLASHLOAN,
  ZERO_ADDR,
};
