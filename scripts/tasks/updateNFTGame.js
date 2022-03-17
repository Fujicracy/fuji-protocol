const { ethers } = require("hardhat");
const { getContractAddress } = require("../utils");

const getVaultsAddrs = (network) => {
  if (network == 'rinkeby') {
    const vaultethusdc = getContractAddress("VaultETHUSDC");
    return [vaultethusdc];
  } else {
    return [];
  }
};

const updateNFTGame = async (nftgameAddress, nftinteractionsAddress, network) => {
  const nftgame = await ethers.getContractAt("NFTGame", nftgameAddress);
  const GAME_INTERACTOR = await nftgame.GAME_INTERACTOR();
  const hasRole = await nftgame.hasRole(GAME_INTERACTOR, nftinteractionsAddress);
  if (!hasRole) {
    const tx = await nftgame.grantRole(GAME_INTERACTOR, nftinteractionsAddress);
    await tx.wait(5);
    console.log("Roles assigned in Nftgame complete");
  } else {
    console.log("NFTGame roles already assigned.");
  }

  const vaults = getVaultsAddrs(network);

  let temptx;
  for (let i = 0; i < vaults.length; i += 1) {
    const vaultAddr = vaults[i];
    const vault = await ethers.getContractAt("FujiVaultFTM", vaultAddr);
    const address = await vault.nftGame();
    if (address != nftgameAddress) {
      temptx = await vault.setNFTGame(nftgameAddress);
      await temptx.wait(5);
    }
  }
  console.log("NFTGame address set in vaults");

  // const recordedvaults = await nftgame.validVaults(0);
  // console.log('recordedvaults', recordedvaults);
  // if (!recordedvaults) {
  //   const tx2 = await nftgame.setValidVaults(vaults);
  //   await tx2.wait(5);
  //   console.log("Valid vaults set in NFTgame");
  // } else {
  //   console.log("Valid vaults already set in NFTgame");
  // }

  const tx2 = await nftgame.setValidVaults(vaults);
  await tx2.wait(5);
  console.log("Valid vaults set in NFTgame");
};

module.exports = {
  updateNFTGame,
};
