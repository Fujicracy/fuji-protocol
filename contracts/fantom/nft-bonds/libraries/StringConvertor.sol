// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./DateTime.sol";

library StringConvertor {
  using Strings for uint256;

  function toString(uint256 value) internal pure returns (string memory) {
    return value.toString();
  }

  function addressToString(address self) internal pure returns (string memory) {
    bytes32 value = bytes32(uint256(uint160(self)));
    bytes memory alphabet = "0123456789abcdef";

    bytes memory str = new bytes(42);
    str[0] = "0";
    str[1] = "x";
    for (uint256 i = 0; i < 20; i++) {
      str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
      str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
    }
    return string(str);
  }

  function uint2decimal(uint256 self, uint8 decimals) internal pure returns (bytes memory) {
    uint256 base = 10**decimals;
    string memory round = uint256(self / base).toString();
    string memory fraction = uint256(self % base).toString();
    uint256 fractionLength = bytes(fraction).length;

    bytes memory fullStr = abi.encodePacked(round, ".");
    if (fractionLength < decimals) {
      for (uint8 i = 0; i < decimals - fractionLength; i++) {
        fullStr = abi.encodePacked(fullStr, "0");
      }
    }

    return abi.encodePacked(fullStr, fraction);
  }

  function trim(bytes memory self, uint256 cutLength) internal pure returns (bytes memory newString) {
    newString = new bytes(self.length - cutLength);
    uint256 nlength = newString.length;
    for(uint i = 0; i < nlength;) {
      newString[i] = self[i];
      unchecked {
        ++i;
      }
    }
  }

  function addThousandsSeparator(bytes memory self) internal pure returns (bytes memory newString) {
    if (self.length <= 6) {
      return self;
    }
    newString = new bytes(self.length + (self.length - 4) / 3);
    uint256 oriIndex = self.length - 1;
    uint256 newIndex = newString.length - 1;
    for(uint256 i = 0; i < newString.length;){
      unchecked{
        newString[newIndex] = self[oriIndex];
        if( i >= 5 && i % 4 == 1 && newString.length - i > 1) {
          newIndex--;
          newString[newIndex] = 0x2c;
          i++;
        }
        i++;
        newIndex--;
        oriIndex--;
        }
    }
  }

  function datetimeToString(uint256 timestamp) internal pure returns (string memory) {
    (
      uint256 year,
      uint256 month,
      uint256 day,
      uint256 hour,
      uint256 minute,
      uint256 second
    ) = DateTime.timestampToDateTime(timestamp);
    return
      string(
        abi.encodePacked(
          year.toString(),
          "/",
          month < 10 ? "0" : "",
          month.toString(),
          "/",
          day < 10 ? "0" : "",
          day.toString(),
          " ",
          hour < 10 ? "0" : "",
          hour.toString(),
          ":",
          minute < 10 ? "0" : "",
          minute.toString(),
          ":",
          second < 10 ? "0" : "",
          second.toString()
        )
      );
  }

  function dateToString(uint256 timestamp) internal pure returns (string memory) {
    (uint256 year, uint256 month, uint256 day) = DateTime.timestampToDate(timestamp);
    return
      string(
        abi.encodePacked(
          year.toString(),
          "/",
          month < 10 ? "0" : "",
          month.toString(),
          "/",
          day < 10 ? "0" : "",
          day.toString()
        )
      );
  }
}
