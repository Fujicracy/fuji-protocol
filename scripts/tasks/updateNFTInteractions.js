const { ethers } = require("hardhat");

const updateNFTInteractions = async (nftinteractionsAddress, nftgameAddress, rewardfactors, priceArray) => {
  const nftinteractions = await ethers.getContractAt("NFTInteractions", nftinteractionsAddress);
  const nftgame = await ethers.getContractAt("NFTGame", nftgameAddress);

  const crateIds = [
    await nftinteractions.CRATE_COMMON_ID(),
    await nftinteractions.CRATE_EPIC_ID(),
    await nftinteractions.CRATE_LEGENDARY_ID(),
  ];

  const pointsDecimals = await nftgame.POINTS_DECIMALS();

  // Simplified low crate prices just for testing
  const prices = priceArray.map((e) => ethers.utils.parseUnits(e.toString(), pointsDecimals));

  for (let i = 0; i < prices.length; i++) {
    await nftinteractions.setCratePrice(crateIds[i], prices[i]);
  }

  for (let i = 0; i < rewardfactors.length; i++) {
    let hasPrice = await nftinteractions.cratePrices(crateIds[i]);
    if (!hasPrice) {
      temptx = await nftinteractions.setCrateRewards(
        crateIds[i],
        rewardfactors[i].map((e) => e * prices[i])
      );
      await temptx.wait();
    }
  }
  console.log("NFTinteractions crate rewards set!");
};

module.exports = {
  updateNFTInteractions,
};
