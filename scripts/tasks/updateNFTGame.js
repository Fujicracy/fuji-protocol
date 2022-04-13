const { ethers } = require("hardhat");

const updateNFTGame = async (nftGameAddress, nftInteractionsAddress, vaults, multiSig, merkleRoot) => {
  // Build ethersjs contract
  const nftgame = await ethers.getContractAt("NFTGame", nftGameAddress);

  // Assigning GAME_INTERACTOR and GAME_ADMIN role in 'NFTGame.sol'
  const GAME_INTERACTOR = await nftgame.GAME_INTERACTOR();
  const GAME_ADMIN = await nftgame.GAME_ADMIN();
  const hasRole1 = await nftgame.hasRole(GAME_INTERACTOR, nftInteractionsAddress);
  const hasRole2 = await nftgame.hasRole(GAME_ADMIN, multiSig);

  if (!hasRole1) {
    const tx = await nftgame.grantRole(GAME_INTERACTOR, nftInteractionsAddress);
    await tx.wait();
    progress.text = "'GAME_INTERACTOR' role assigned in Nftgame complete!";
  } else {
    progress.text = "'GAME_INTERACTOR' role already assigned!";
  }

  if (!hasRole2) {
    const tx = await nftgame.grantRole(GAME_ADMIN, multiSig);
    await tx.wait();
    progress.text = "'GAME_ADMIN' role assigned in Nftgame complete!";
  } else {
    progress.text = "'GAME_ADMIN' role already assigned!";
  }

  if (merkleRoot) {
    const tx = await nftgame.setMerkleRoot(merkleRoot);
    progress.text = "...setting merkleRoot in NFTgame";
    await tx.wait();
    progress.text = "MerkleRoot succesfully set in NFTgame";
  } else {
    progress.text = "\nMerkleRoot is NOT set!";
  }

  // Setting NFTGame address in vaults
  // Ensure vaults array has contents
  if (vaults.length > 0) {
    for (let i = 0; i < vaults.length; i += 1) {
      const vaultAddr = vaults[i];
      const vault = await ethers.getContractAt("FujiVaultFTM", vaultAddr);
      const returnedAddress = await vault.nftGame();
      if (returnedAddress != nftGameAddress) {
        try {
          const tx = await vault.setNFTGame(nftGameAddress);
          progress.text = `...setting NFTGame address in vault ${vaultAddr}`;
          await tx.wait();
          progress.text = `NFTGame address succesfully set in vault ${vaultAddr}`;
        } catch (error) {
          console.warn("ERROR: Could not set NFTGame address, check vault contract owner!");
          console.debug(error);
        }
      } else {
        progress.text = `...skipping NFTGame address already set in vault ${vaultAddr}`;
      }
    }

    // Setting valid vaults in NFTGame.sol
    const tx2 = await nftgame.setValidVaults(vaults);
    progress.text = "...setting valid vaults in NFTgame";
    await tx2.wait();
    progress.text = "Valid vaults succesfully set in NFTgame";

  } else {
    console.warn("\nNo vault addresses passed in 'updateNFTGame()'");
  }
};

module.exports = {
  updateNFTGame,
};
