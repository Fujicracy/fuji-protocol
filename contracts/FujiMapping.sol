// SPDX-License-Identifier: MIT
//FujiMapping for receiptToken Address Mapping in Base Lending Protocols, inspired by InstaDapp

pragma solidity >=0.4.25 <0.8.0;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import {Errors} from './Debt-token/Errors.sol';

contract FujiMapping is Ownable {

  // Protocol ID => Asset Address (ERC20) => ReceiptToken Address (aToken, cToken, etc)
  mapping (uint256 => mapping (address => address)) public TokenMapping;

  /**
  * @dev Adds a Mapping protocol => to underlying asset => to receiptToken.
  * @param Tkn: array of receiptToken addresses
  * @param Erc20: array of corresponding underlying ERC20 addresses
  */
  function addTknMapping(uint256 _protocolID, address[] memory Tkn, address[] memory Erc20) public onlyOwner {
        require(Tkn.length > 0 || Erc20.length == Tkn.length, Errors.VL_INPUT_ERROR);
        for (uint i = 0; i < Tkn.length; i++) {
            address receiptErc20 = Tkn[i];
            address erc20addr = Erc20[i];
            require(TokenMapping[_protocolID][Erc20[i]] == address(0), Errors.VL_INPUT_ERROR);
            TokenMapping[_protocolID][Erc20[i]] = receiptErc20;
        }
    }
}
