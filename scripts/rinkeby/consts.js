// Rinkeby
const ASSETS = {
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa",
    oracle: "0x2bA49Aaa16E6afD2a993473cfB70Fa8559B523cF",
    decimals: 18,
  },
  USDC: {
    name: "usdc",
    nameUp: "USDC",
    address: "0x4DBCdF9B62e891a7cec5A2568C3F4FAF9E8Abe2b",
    oracle: "0xa24de01df22b63d23Ebc1882a5E3d4ec0d907bFB",
    decimals: 6,
  }
};

const DEX_ROUTER_ADDR = "0x0000000000000000000000000000000000000000";
const LIB_PSEUDORANDOM = "0xaa98909937a95B46285d5D7EFFCCD0A50E614eCf";

module.exports = {
  ASSETS,
  DEX_ROUTER_ADDR,
  LIB_PSEUDORANDOM
};
