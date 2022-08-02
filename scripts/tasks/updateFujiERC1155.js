const { ethers } = require("hardhat");
const { callIf } = require("../utils");

const updateFujiERC1155 = async (f1155, permitAddresses) => {
  const f1155Contract = await ethers.getContractAt("FujiERC1155", f1155);

  for (let i = 0; i < permitAddresses.length; i++) {
    const permitAddress = permitAddresses[i];
    await callIf(
      "setPermit - " + permitAddress,
      async () => !(await f1155Contract.addrPermit(permitAddress)),
      async () => {
        let tx = await f1155Contract.setPermit(permitAddress, true);
        await tx.wait();
      }
    );
  }
};

module.exports = {
  updateFujiERC1155,
};
