const ASSETS = {
  FTM: {
    name: "ftm",
    nameUp: "FTM",
    address: "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
    oracle: "0xf4766552D15AE4d256Ad41B6cf2933482B0680dc",
    decimals: 18,
  },
  DAI: {
    name: "dai",
    nameUp: "DAI",
    address: "0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E",
    oracle: "0x91d5DEFAFfE2854C7D02F50c80FA1fdc8A721e52",
    decimals: 18,
  },
  USDC: {
    name: "usdc",
    nameUp: "USDC",
    address: "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75",
    oracle: "0x2553f4eeb82d5A26427b8d1106C51499CBa5D99c",
    decimals: 6,
  },
  WFTM: {
    name: "wftm",
    nameUp: "WFTM",
    address: "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83",
    oracle: "0xf4766552D15AE4d256Ad41B6cf2933482B0680dc",
    decimals: 18,
  },
  WETH: {
    name: "weth",
    nameUp: "WETH",
    address: "0x74b23882a30290451A17c44f4F05243b6b58C76d",
    oracle: "0x11DdD3d147E5b83D01cee7070027092397d63658",
    decimals: 18,
  },
  WBTC: {
    name: "wbtc",
    nameUp: "WBTC",
    address: "0x321162Cd933E2Be498Cd2267a90534A804051b11",
    oracle: "0x8e94C22142F4A64b99022ccDd994f4e9EC86E4B4",
    decimals: 8,
  },
};

const SPOOKY_ROUTER_ADDR = "0xF491e7B69E4244ad4002BC14e878a34207E38c29";

const { LIB_PSEUDORANDOM } = require("../../test/fantom/utils");

module.exports = {
  ASSETS,
  SPOOKY_ROUTER_ADDR,
  LIB_PSEUDORANDOM
};
