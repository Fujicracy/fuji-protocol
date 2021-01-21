// SPDX-License-Identifier: MIT

pragma solidity >=0.4.25 <0.7.0;
pragma experimental ABIEncoderV2;
import "./LibUniERC20.sol";
import "./IProvider.sol";

interface TokenInterface {
    function approve(address, uint256) external;
    function transfer(address, uint) external;
    function transferFrom(address, address, uint) external;
    function deposit() external payable;
    function withdraw(uint) external;
    function balanceOf(address) external view returns (uint);
    function decimals() external view returns (uint);
}

interface AaveInterface {
    function deposit(address _asset, uint256 _amount, address _onBehalfOf, uint16 _referralCode) external;
    function withdraw(address _asset, uint256 _amount, address _to) external;
    function borrow(
        address _asset,
        uint256 _amount,
        uint256 _interestRateMode,
        uint16 _referralCode,
        address _onBehalfOf
    ) external;
    function repay(address _asset, uint256 _amount, uint256 _rateMode, address _onBehalfOf) external;
    function setUserUseReserveAsCollateral(address _asset, bool _useAsCollateral) external;
}

interface AaveLendingPoolProviderInterface {
    function getLendingPool() external view returns (address);
}

// Aave Protocol Data Provider
interface AaveDataProviderInterface {
    function getReserveTokensAddresses(address _asset) external view returns (
        address aTokenAddress,
        address stableDebtTokenAddress,
        address variableDebtTokenAddress
    );
    function getUserReserveData(address _asset, address _user) external view returns (
        uint256 currentATokenBalance,
        uint256 currentStableDebt,
        uint256 currentVariableDebt,
        uint256 principalStableDebt,
        uint256 scaledVariableDebt,
        uint256 stableBorrowRate,
        uint256 liquidityRate,
        uint40 stableRateLastUpdated,
        bool usageAsCollateralEnabled
    );
}

interface AaveAddressProviderRegistryInterface {
    function getAddressesProvidersList() external view returns (address[] memory);
}

interface ATokenInterface {
    function balanceOf(address _user) external view returns(uint256);
}

contract ProviderAave is IProvider {
  using SafeMath for uint256;
  using UniERC20 for IERC20;

  /**
     * @dev get Aave Lending Pool Provider
    */
    function getAaveProvider() internal pure returns (AaveLendingPoolProviderInterface) {
        return AaveLendingPoolProviderInterface(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5); //mainnet
        // return AaveLendingPoolProviderInterface(0x652B2937Efd0B5beA1c8d54293FC1289672AFC6b); //kovan
    }

    /**
     * @dev get Aave Protocol Data Provider
    */
    function getAaveDataProvider() internal pure returns (AaveDataProviderInterface) {
        return AaveDataProviderInterface(0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d); //mainnet
        // return AaveDataProviderInterface(0x744C1aaA95232EeF8A9994C4E0b3a89659D9AB79); //kovan
    }

    /**
     * @dev Return Weth address
    */
    function getWethAddr() internal pure returns (address) {
        return 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // Mainnet WETH Address
        // return 0xd0A1E359811322d97991E03f863a0C30C2cF029C; // Kovan WETH Address
    }
      /**
   * @dev Return ethereum address
   */
  function getEthAddr() internal pure returns (address) {
    return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE; // ETH Address
  }

    function getIsColl(AaveDataProviderInterface aaveData, address token, address user) internal view returns (bool isCol) {
        (, , , , , , , , isCol) = aaveData.getUserReserveData(token, user);
    }

    function convertEthToWeth(bool isEth, TokenInterface token, uint amount) internal {
        if(isEth) token.deposit.value(amount)();
    }

    function convertWethToEth(bool isEth, TokenInterface token, uint amount) internal {
       if(isEth) {
            token.approve(address(token), amount);
            token.withdraw(amount);
        }
    }


  function borrow(
    address borrowAsset,
    uint256 borrowAmount
  ) external override payable {
    // TODO
  }

    function deposit(address collateralAsset, uint collateralAmount) external override payable {

        AaveInterface aave = AaveInterface(getAaveProvider().getLendingPool());
        AaveDataProviderInterface aaveData = getAaveDataProvider();

        bool isEth = collateralAsset == getEthAddr();
        address _token = isEth ? getWethAddr() : collateralAsset;

        TokenInterface tokenContract = TokenInterface(_token);

        if (isEth) {
            collateralAmount = collateralAmount == uint(-1) ? address(this).balance : collateralAmount;
            convertEthToWeth(isEth, tokenContract, collateralAmount);
        } else {
            collateralAmount = collateralAmount == uint(-1) ? tokenContract.balanceOf(address(this)) : collateralAmount;
        }

        tokenContract.approve(address(aave), collateralAmount);

        aave.deposit(_token, collateralAmount, address(this), 0);

        if (!getIsColl(aaveData, _token, address(this))) {
            aave.setUserUseReserveAsCollateral(_token, true);
        }
    }
}



   