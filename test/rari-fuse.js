const { ethers, waffle } = require("hardhat");
const { expect } = require("chai");
const { createFixtureLoader } = require("ethereum-waffle");
const { deployContract } = waffle;
const { getContractAt } = ethers;

const { fixture, convertToWei, evmSnapshot, evmRevert, DAI_ADDR, USDC_ADDR } = require("./utils-alpha");

const Fuse3 = require("../artifacts/contracts/Providers/ProviderFuse3.sol/ProviderFuse3.json");
const Fuse18 = require("../artifacts/contracts/Providers/ProviderFuse18.sol/ProviderFuse18.json");

describe("Rari Fuse", () => {
  let dai;
  let usdc;
  let fuse3;
  let fuse18;
  let vaults;

  let users;

  let loadFixture;
  let evmSnapshotId;

  const fuse3ComptrollerAddr = "0x6E7fb6c5865e8533D5ED31b6d43fD95f4C411834";
  const fuse18ComptrollerAddr = "0x621579DD26774022F33147D3852ef4E00024b763";

  before(async () => {
    users = await ethers.getSigners();
    loadFixture = createFixtureLoader(users, ethers.provider);
    evmSnapshotId = await evmSnapshot();

    fuse3 = await deployContract(users[0], Fuse3, []);
    fuse18 = await deployContract(users[0], Fuse18, []);

    fuse3Comptroller = await getContractAt("IFuseComptroller", fuse3ComptrollerAddr);
  });

  after(async () => {
    evmRevert(evmSnapshotId);
  });

  beforeEach(async () => {
    const f = await loadFixture(fixture);
    dai = f.dai;
    usdc = f.usdc;
    vaults = [f.vaultdai, f.vaultusdc, f.vaultusdt, f.vaultdaieth, f.vaultdaiusdc, f.vaultdaiusdt];
    for (let i = 0; i < vaults.length; i += 1) {
      await vaults[i].setProviders([fuse3.address]);
      await vaults[i].setActiveProvider(fuse3.address);
    }
  });

  it("first test", async() => {
    const userX = users[1];
    const depositAmount = convertToWei(11.9999);
    const negdepositAmount = convertToWei(-11.9999);

    await expect(
      await vaults[0].connect(userX).deposit(depositAmount, { value: depositAmount })
    ).to.changeEtherBalance(userX, negdepositAmount);

    const cTokenAddr = await fuse3Comptroller.cTokensByUnderlying("0x0000000000000000000000000000000000000000");
    const cETH = await getContractAt("ICEth", cTokenAddr);
    const vaultBal = await cETH.balanceOf(vaults[0].address);
    const rate = await cETH.exchangeRateStored();
    const cethAmount = (depositAmount * 1e18) / rate;
    await expect(vaultBal / 1).to.be.closeTo(cethAmount / 1, 100);

  });
});
