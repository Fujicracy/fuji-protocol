const { ethers } = require("hardhat");
const { parseUnits } = require("../../test/helpers");

const updatePreTokenBonds = async (
  pretokenbondAddress,
  nftinteractionsAddress,
  POINTS_DECIMALS,
  TEST_PARAM
) => {
  // Build ethersjs contract
  const pretokenbonds = await ethers.getContractAt("PreTokenBonds", pretokenbondAddress);
  const nftinteractions = await ethers.getContractAt("NFTInteractions", nftinteractionsAddress);

    // Setting pretokenbond address
    const checkAddress = await nftinteractions.preTokenBonds();
    if (checkAddress != pretokenbondAddress) {
      let tx3 = await nftinteractions.setPreTokenBonds(pretokenbondAddress);
      console.log(`...setting PreTokenBonds  address`);
      await tx3.wait();
      console.log(`succesfully set PreTokenBonds address`);
    } else {
      console.log(`...skipping: PreTokenBonds address already set`);
    }

  if (TEST_PARAM) {
    // Override for testing only: change to low bond price if needed
    // Contract default is 10,000 meter points per bond.
    let tx4 = await pretokenbonds.setBondPrice(parseUnits(10000, POINTS_DECIMALS));
    await tx4.wait();
  }
}

module.exports = {
  updatePreTokenBonds,
};
