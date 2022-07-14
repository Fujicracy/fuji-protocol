const ASSETS = {
  ETH: {
    name: "eth",
    nameUp: "ETH",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    oracle: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    aTokenV3: "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8",
    decimals: 18,
  },
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    oracle: "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB",
    aTokenV3: "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
    decimals: 18,
  },
  USDC: {
    name: "usdc",
    nameUp: "USDC",
    address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    oracle: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
    aTokenV3: "0x625E7708f30cA75bfd92586e17077590C60eb4cD",
    decimals: 6,
  },
  WETH: {
    name: "weth",
    nameUp: "WETH",
    address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    oracle: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    aTokenV3: "0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8",
    decimals: 18,
  },
  WBTC: {
    name: "wbtc",
    nameUp: "WBTC",
    address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    oracle: "0x6ce185860a4963106506C203335A2910413708e9",
    aTokenV3: "0x078f358208685046a11C85e8ad32895DED33A249",
    decimals: 8,
  },
};

const SUSHISWAP_ROUTER_ADDR = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";

module.exports = {
  ASSETS,
  SUSHISWAP_ROUTER_ADDR,
};
