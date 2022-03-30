const { ethers } = require("hardhat");

const updateNFTGame = async (nftgameAddress, nftinteractionsAddress, vaults) => {
  // Build ethersjs contract
  const nftgame = await ethers.getContractAt("NFTGame", nftgameAddress);

  // Assigning GAME_INTERACTOR role in 'NFTGame.sol'
  const GAME_INTERACTOR = await nftgame.GAME_INTERACTOR();
  const hasRole = await nftgame.hasRole(GAME_INTERACTOR, nftinteractionsAddress);
  if (!hasRole) {
    const tx = await nftgame.grantRole(GAME_INTERACTOR, nftinteractionsAddress);
    await tx.wait();
    console.log("'GAME_INTERACTOR' roles assigned in Nftgame complete");
  } else {
    console.log("'GAME_INTERACTOR' roles already assigned!");
  }

  // Setting NFTGame address in vaults
  for (let i = 0; i < vaults.length; i += 1) {
    const vaultAddr = vaults[i];
    const vault = await ethers.getContractAt("FujiVaultFTM", vaultAddr);
    const returnedAddress = await vault.nftGame();
    if (returnedAddress != nftgameAddress) {
      try {
        let tx = await vault.setNFTGame(nftgameAddress);
        console.log(`...setting NFTGame address in vault ${vaultAddr}`);
        await tx.wait();
        console.log(`NFTGame address succesfully set in vault ${vaultAddr}`);
      } catch (error) {
        console.log("ERROR: Could not set NFTGame address, check vault contract owner!");
        console.log(error);
      }
    } else {
      console.log(`...skipping NFTGame address already set in vault ${vaultAddr}`);
    }
  }

  // Setting valid vaults in NFTGame.sol
  const tx2 = await nftgame.setValidVaults(vaults);
  console.log("...setting valid vaults in NFTgame");
  await tx2.wait();
  console.log("Valid vaults succesfully set in NFTgame");
};

module.exports = {
  updateNFTGame,
};
