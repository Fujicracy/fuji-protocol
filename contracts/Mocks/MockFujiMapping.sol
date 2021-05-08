// SPDX-License-Identifier: MIT
//FujiMapping for two addresses

pragma solidity >=0.4.25 <0.8.0;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract MockFujiMapping is Ownable {

    //   Address 1 =>  Address 2 (e.g. erc20 => cToken, contract a L1 => contract b L2, etc)
  mapping (address => address) public addressMapping;

  //URI for mapping legend
  //https://mapping.fujiDao.org/WebFujiMapping.json
  string public _uri;

  constructor() public {

    setMapping(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE, 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5);
    setMapping(0x6B175474E89094C44Da98b954EedeAC495271d0F, 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643);
    setMapping(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48, 0x39AA39c021dfbaE8faC545936693aC917d5E7563);
    setMapping(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9);
    setMapping(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE, 0xD06527D5e56A3495252A528C4987003b712860eE);
    setMapping(0x6B175474E89094C44Da98b954EedeAC495271d0F, 0x92B767185fB3B04F881e3aC8e5B0662a027A1D9f);
    setMapping(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48, 0x44fbeBd2F576670a6C33f6Fc0B00aA8c5753b322);
    setMapping(0xdAC17F958D2ee523a2206206994597C13D831ec7, 0x797AAB1ce7c01eB727ab980762bA88e7133d2157);

  }

  /**
  * @dev Adds a two address Mapping
  * @param _addr1: key address for mapping (erc20, provider)
  * @param _addr2: result address (cToken, erc20)
  */
  function setMapping(address _addr1, address _addr2) public onlyOwner {
    addressMapping[_addr1] = _addr2;
  }

  /**
  * @dev Sets a new URI for all token types, by relying on the token type ID
  */
  function setURI(string memory newuri) public onlyOwner {
    _uri = newuri;
  }

}
