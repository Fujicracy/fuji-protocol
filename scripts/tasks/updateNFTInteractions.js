const { ethers } = require("hardhat");

const updateNFTInteractions = async (
  nftinteractionsAddress,
  crateIds,
  rewardfactors,
  prices
) => {
  // Build ethersjs contract
  const nftinteractions = await ethers.getContractAt("NFTInteractions", nftinteractionsAddress);

  // Setting crate prices 
  for (let i = 0; i < crateIds.length; i++) {
    const hasPrice = await nftinteractions.cratePrices(crateIds[i]);
    if (hasPrice > 0) {
      const tx1 = await nftinteractions.setCratePrice(crateIds[i], prices[i]);
      console.log(`...setting crate price for Crate_Id: ${crateIds[i]}`);
      await tx1.wait();
      console.log(`Price succesfully set for Crate_Id: ${crateIds[i]}`);
    } else {
      console.log(`...skipping: price already set for Crate_Id: ${crateIds[i]}`);
    }
  }

  // Setting crate rewards
  let hasRewards = [];
  for (let i = 0; i < rewardfactors.length; i++) {
    hasRewards = await nftinteractions.getCrateRewards(crateIds[i]);
    if (hasRewards.length != 5) {
      let tx2 = await nftinteractions.setCrateRewards(
        crateIds[i],
        rewardfactors[i].map((e) => e * prices[i])
      );
      console.log(`...setting crate rewards for Crate_Id: ${crateIds[i]}`);
      await tx2.wait();
      console.log(`Rewards succesfully set for Crate_Id: ${crateIds[i]}`);
    } else {
      console.log(`...skipping: rewards already set for Crate_Id: ${crateIds[i]}`);
    }
  }
};

module.exports = {
  updateNFTInteractions,
};
