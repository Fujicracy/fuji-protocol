const { ethers } = require("hardhat");
const {
  parseUnits
} = require("../../test/helpers");

const updatePreTokenBonds = async (
  pretokenbondAddress,
  nftinteractionsAddress,
  uris=[],
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
      progress.text = `...setting PreTokenBonds  address`;
      await tx3.wait();
      progress.text = `succesfully set PreTokenBonds address`;
    } else {
      progress.text = `...skipping: PreTokenBonds address already set`;
    }

  if (TEST_PARAM) {

    let tx1 = await pretokenbonds.setBaseTokenURI("https://www.example.com/metadata/token/");
    await tx1.wait();
    let tx2 = await pretokenbonds.setContractURI("https://www.example.com/metadata/contract.json");
    await tx2.wait();
    let tx3 = await pretokenbonds.setBaseSlotURI("https://www.example.com/metadata/slot/");
    await tx3.wait();

    // Override for testing only: change to low bond price
    let tx4 = await pretokenbonds.setBondPrice(parseUnits(1, POINTS_DECIMALS));
    await tx4.wait();

  } else if (uris.length == 3) {
    for (let i = 0; i < uris.length; i++) {
      let txu = await pretokenbonds.setBaseTokenURI(uris[i]);
      progress.text = `...setting uri ${i+1} of 3`;
      await txu.wait();
    }
    progress.text = `success setting all URIs!`;
  }
}

module.exports = {
  updatePreTokenBonds,
};