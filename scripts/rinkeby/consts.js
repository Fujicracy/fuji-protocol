// Rinkeby
const ASSETS = {
  ETH: {
    name: "eth",
    nameUp: "ETH",
    address: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
    oracle: "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e",
    decimals: 18,
  },
  USDC: {
    name: "usdc",
    nameUp: "USDC",
    address: "0x4DBCdF9B62e891a7cec5A2568C3F4FAF9E8Abe2b",
    oracle: "0xa24de01df22b63d23Ebc1882a5E3d4ec0d907bFB",
    decimals: 6,
  },
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "",
    oracle: "",
    decimals: 18,
  },
};

const DEX_ROUTER_ADDR = "0x0000000000000000000000000000000000000000";

module.exports = {
  ASSETS,
  DEX_ROUTER_ADDR,
};
