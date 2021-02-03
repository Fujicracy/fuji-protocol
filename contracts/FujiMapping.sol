// SPDX-License-Identifier: MIT
//FujiMapping for cToken Addresses in Compound Protocol, inspired by InstaDapp

pragma solidity ^0.6.0;

interface CTokenInterface {
    function underlying() external view returns (address);
}

contract FujiMapping {

  mapping (address => address) public cTokenMapping;

  address private owner;

  event LogAddCTokenMapping(address[] cTokens);

  modifier isAuthorized() {
    require(msg.sender == address(this) || msg.sender == owner, "!authorized");
    _;
  }

  /**
  * @dev Defines contract owner and passes network argument to map Eth address.
  * @param _owner:  owner authorized to modify contract's state variables
  *@ param network: string, accepts only "mainnet" or "kovan"
  */
  constructor(address _owner, string memory network) public {
        owner = _owner;

        bytes32  _network = keccak256(abi.encodePacked(network));
        bytes32  mainnet = keccak256(abi.encodePacked("mainnet"));
        bytes32  kovan = keccak256(abi.encodePacked("kovan"));

        bool[2] memory manualOrcheck;

        if(_network == mainnet){
            manualOrcheck[0] = true;
            address ethAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
            address cEth = 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5;
            cTokenMapping[ethAddress] = cEth;

        } else if (_network == kovan){
            manualOrcheck[1] = true;

            address ethAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
            address cEth = 0x41B5844f4680a8C38fBb695b7F9CFd1F64474a72;
            cTokenMapping[ethAddress] = cEth;

        } else { manualOrcheck[0] = false; manualOrcheck[1] =false;}

        require( manualOrcheck[0] == true || manualOrcheck[1] == true, "Network should be mainnet or kovan!");
    }

    /**
    * @dev Adds a cToken to underlying asset mapping.
    * @param cTkn: array of cToken addresses
    */
    function addCtknMapping(address[] memory cTkn) public isAuthorized {
        require(cTkn.length > 0, "No-CToken-Address");
        for (uint i = 0; i < cTkn.length; i++) {
            address cErc20 = cTkn[i];
            address erc20 = CTokenInterface(cErc20).underlying();
            require(cTokenMapping[erc20] == address(0), "Token-Already-Added");
            cTokenMapping[erc20] = cErc20;
        }
        emit LogAddCTokenMapping(cTkn);
    }
}
