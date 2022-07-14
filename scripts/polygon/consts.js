const ASSETS = {
  MATIC: {
    name: "matic",
    nameUp: "MATIC",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    oracle: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
    decimals: 18,
  },
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    oracle: "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D",
    decimals: 18,
  },
  USDC: {
    name: "usdc",
    nameUp: "USDC",
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    oracle: "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7",
    decimals: 6,
  },
  WMATIC: {
    name: "wmatic",
    nameUp: "WMATIC",
    address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    oracle: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
    decimals: 18,
  },
  WETH: {
    name: "weth",
    nameUp: "WETH",
    address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    oracle: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
    decimals: 18,
  },
  WBTC: {
    name: "wbtc",
    nameUp: "WBTC",
    address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
    oracle: "0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6",
    decimals: 8,
  },
};

const TREASURY = "0x61998e033978FaF85DCAD6f931023cb3138013e9";

const QUICK_ROUTER_ADDR = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

module.exports = {
  ASSETS,
  TREASURY,
  QUICK_ROUTER_ADDR,
};
