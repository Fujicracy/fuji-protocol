const { ethers, waffle } = require("hardhat");
const { deployContract } = waffle;

const CHAINLINK_ORACLE_ADDR = "0x773616E4d11A78F511299002da57A0a94577F1f4";
const UNISWAP_ROUTER_ADDR = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const DAI_ADDR = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const USDC_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDT_ADDR = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const ETH_ADDR = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const aWETH_ADDR = "0x030bA81f1c18d280636F32af80b9AAd02Cf0854e";
const cETH_ADDR = "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5";

const ONE_ETH = ethers.utils.parseEther("1.0");

const FujiAdmin = require("../artifacts/contracts/FujiAdmin.sol/FujiAdmin.json");
const Fliquidator = require("../artifacts/contracts/Fliquidator.sol/Fliquidator.json");
const AWhitelist = require("../artifacts/contracts/AlphaWhitelist.sol/AlphaWhitelist.json");
const VaultETHDAI = require("../artifacts/contracts/Vaults/VaultETHDAI.sol/VaultETHDAI.json");
const VaultETHUSDC = require("../artifacts/contracts/Vaults/VaultETHUSDC.sol/VaultETHUSDC.json");
const VaultETHUSDT = require("../artifacts/contracts/Vaults/VaultETHUSDT.sol/VaultETHUSDT.json");
const Aave = require("../artifacts/contracts/Providers/ProviderAave.sol/ProviderAave.json");
const Compound = require("../artifacts/contracts/Providers/ProviderCompound.sol/ProviderCompound.json");
const Dydx = require("../artifacts/contracts/Providers/ProviderDYDX.sol/ProviderDYDX.json")
const F1155 = require("../artifacts/contracts/FujiERC1155/FujiERC1155.sol/FujiERC1155.json");
const Flasher = require("../artifacts/contracts/Flashloans/Flasher.sol/Flasher.json");
const Controller = require("../artifacts/contracts/Controller.sol/Controller.json");
const Treasury = require("../artifacts/contracts/Gnosis Treasury/GnosisSafe.sol/GnosisSafe.json")

const fixture = async ([wallet, other], provider) => {

  const dai = await ethers.getContractAt("IERC20", DAI_ADDR);
  const usdc = await ethers.getContractAt("IERC20", USDC_ADDR);
  const usdt = await ethers.getContractAt("IERC20", USDT_ADDR);
  const aweth = await ethers.getContractAt("IERC20", aWETH_ADDR);
  const ceth = await ethers.getContractAt("CErc20", cETH_ADDR);
  const oracle = await ethers.getContractAt("AggregatorV3Interface", CHAINLINK_ORACLE_ADDR);

  // Step 1 of Deploy: Contracts which address is required to be hardcoded in other contracts
  //Fuji Mapping, for testing this is not required.
  const treasury = await deployContract(wallet, Treasury, []);

  // Step 2 Of Deploy: Functional Contracts
  const fujiadmin = await deployContract(wallet, FujiAdmin,[]);
  const fliquidator = await deployContract(wallet, Fliquidator, []);
  const flasher = await deployContract(wallet, Flasher, []);
  const controller = await deployContract(wallet, Controller, []);
  const f1155 = await deployContract(wallet, F1155, []);

  // Step 3 Of Deploy: Provider Contracts
  const aave = await deployContract(wallet, Aave, []);
  const compound = await deployContract(wallet, Compound, []);
  const dydx = await deployContract(wallet, Dydx, []);

  // Step 4 Of Deploy Core Money Handling Contracts
  const aWhitelist = await deployContract(wallet, AWhitelist,
    [
      "100",
      ethers.utils.parseEther("12"),
      fliquidator.address
    ]);
  const vaultdai = await deployContract(wallet, VaultETHDAI,[]);
  const vaultusdc = await deployContract(wallet, VaultETHUSDC,[]);
  const vaultusdt = await deployContract(wallet, VaultETHUSDT,[]);

  // Step 5 - General Plug-ins and Set-up Transactions
  await fujiadmin.setFlasher(flasher.address);
  await fujiadmin.setFliquidator(fliquidator.address);
  await fujiadmin.setTreasury(treasury.address);
  await fujiadmin.setController(controller.address);
  await fujiadmin.setaWhitelist(aWhitelist.address);
  await fliquidator.setfujiAdmin(fujiadmin.address);
  await fliquidator.setSwapper(UNISWAP_ROUTER_ADDR);
  await flasher.setfujiAdmin(fujiadmin.address);
  await controller.setfujiAdmin(fujiadmin.address);
  await f1155.setPermit(fliquidator.address, true);
  await f1155.setPermit(vaultdai.address, true);
  await f1155.setPermit(vaultusdc.address, true);
  await f1155.setPermit(vaultusdt.address, true);

  // Step 6 - Vault Set-up
  await vaultdai.setfujiAdmin(fujiadmin.address)
  await vaultdai.setProviders([compound.address, aave.address, dydx.address]);
  await vaultdai.setActiveProvider(compound.address);
  await vaultdai.setFujiERC1155(f1155.address);
  await vaultdai.setOracle(CHAINLINK_ORACLE_ADDR);

  await vaultusdc.setfujiAdmin(fujiadmin.address);
  await vaultusdc.setProviders([compound.address, aave.address, dydx.address]);
  await vaultusdc.setActiveProvider(compound.address);
  await vaultusdc.setFujiERC1155(f1155.address);
  await vaultusdc.setOracle(CHAINLINK_ORACLE_ADDR);

  await vaultusdt.setfujiAdmin(fujiadmin.address);
  await vaultusdt.setProviders([compound.address, aave.address]);
  await vaultusdt.setActiveProvider(compound.address);
  await vaultusdt.setFujiERC1155(f1155.address);
  await vaultusdt.setOracle(CHAINLINK_ORACLE_ADDR);

  return {
    dai,
    usdc,
    usdt,
    aweth,
    ceth,
    oracle,
    treasury,
    fujiadmin,
    fliquidator,
    flasher,
    controller,
    f1155,
    aave,
    compound,
    dydx,
    aWhitelist,
    vaultdai,
    vaultusdc,
    vaultusdt
  }
}

const timeTravel = async (seconds) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
}

const advanceblocks = async (blocks) => {
  for (var i = 0; i < blocks; i++) {
    await ethers.provider.send("evm_mine");
  }
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
  advanceblocks,
  convertToCurrencyDecimals,
  convertToWei,
  DAI_ADDR,
  USDC_ADDR,
  USDT_ADDR,
  ONE_ETH,
  evmSnapshot,
  evmRevert
}
