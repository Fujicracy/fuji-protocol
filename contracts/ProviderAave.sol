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
  function getReserveData(address asset) external view returns (
    uint256 availableLiquidity,
    uint256 totalStableDebt,
    uint256 totalVariableDebt,
    uint256 liquidityRate,
    uint256 variableBorrowRate,
    uint256 stableBorrowRate,
    uint256 averageStableBorrowRate,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex,
    uint40 lastUpdateTimestamp
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

  function getAaveProvider() internal pure returns (AaveLendingPoolProviderInterface) {
    return AaveLendingPoolProviderInterface(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5); //mainnet
  }

  function getAaveDataProvider() internal pure returns (AaveDataProviderInterface) {
    return AaveDataProviderInterface(0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d); //mainnet
  }

  function getWethAddr() internal pure returns (address) {
    return 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // Mainnet WETH Address
  }

  function getEthAddr() internal pure returns (address) {
    return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE; // ETH Address
  }

  function getIsColl(AaveDataProviderInterface aaveData, address token, address user) internal view returns (bool isCol) {
    (, , , , , , , , isCol) = aaveData.getUserReserveData(token, user);
  }

  function convertEthToWeth(bool isEth, TokenInterface token, uint amount) internal {
    if(isEth) token.deposit{value : amount }();
  }

  function convertWethToEth(bool isEth, TokenInterface token, uint amount) internal {
    if(isEth) {
      token.approve(address(token), amount);
      token.withdraw(amount);
    }
  }

  function getBorrowRateFor(address asset) external view override returns(uint256) {

    AaveDataProviderInterface aaveData = getAaveDataProvider();

    bool isEth = asset == getEthAddr();
    address botoken = isEth ? getWethAddr() : asset;

    (, ,, ,uint256 variableBorrowRate, , , , ,) = AaveDataProviderInterface(aaveData).getReserveData(botoken);
    return variableBorrowRate;
  }

  function getRedeemableAddress(address collateralAsset) external view override returns(address) {

    AaveDataProviderInterface aaveData = getAaveDataProvider();

    bool isEth = collateralAsset == getEthAddr();
    address token = isEth ? getWethAddr() : collateralAsset;

    (address aTokenAddress,,) = AaveDataProviderInterface(aaveData).getReserveTokensAddresses(token);

    return aTokenAddress;
  }

  function getBorrowBalance(address borrowAsset) external override returns(uint256) {
    AaveDataProviderInterface aaveData = getAaveDataProvider();

    bool isEth = borrowAsset == getEthAddr();
    address _token = isEth ? getWethAddr() : borrowAsset;

    (,, uint variableDebt, , , , , , ) = aaveData.getUserReserveData(_token, msg.sender);
    return variableDebt;
  }

  function deposit(address collateralAsset, uint256 collateralAmount) external override payable {

    AaveInterface aave = AaveInterface(getAaveProvider().getLendingPool());
    AaveDataProviderInterface aaveData = getAaveDataProvider();

    bool isEth = collateralAsset == getEthAddr();
    address _token = isEth ? getWethAddr() : collateralAsset;

    TokenInterface tokenContract = TokenInterface(_token);

    if (isEth) {
      collateralAmount = collateralAmount == uint256(-1) ? address(this).balance : collateralAmount;
      convertEthToWeth(isEth, tokenContract, collateralAmount);
    }
    else {
      collateralAmount = collateralAmount == uint256(-1) ? tokenContract.balanceOf(address(this)) : collateralAmount;
    }

    tokenContract.approve(address(aave), collateralAmount);

    aave.deposit(_token, collateralAmount, address(this), 0);

    if (!getIsColl(aaveData, _token, address(this))) {
      aave.setUserUseReserveAsCollateral(_token, true);
    }
  }

  function borrow(address borrowAsset, uint256 borrowAmount) external override payable {

    AaveInterface aave = AaveInterface(getAaveProvider().getLendingPool());

    bool isEth = borrowAsset == getEthAddr();
    address _token = isEth ? getWethAddr() : borrowAsset;

    aave.borrow(_token, borrowAmount, 2, 0, address(this));
    convertWethToEth(isEth, TokenInterface(_token), borrowAmount);
  }

  function withdraw(address collateralAsset, uint256 collateralAmount) external override payable {

    AaveInterface aave = AaveInterface(getAaveProvider().getLendingPool());

    bool isEth = collateralAsset == getEthAddr();
    address _token = isEth ? getWethAddr() : collateralAsset;

    TokenInterface tokenContract = TokenInterface(_token);

    uint256 initialBal = tokenContract.balanceOf(address(this));
    aave.withdraw(_token, collateralAmount, address(this));
    uint256 finalBal = tokenContract.balanceOf(address(this));

    collateralAmount = finalBal.sub(initialBal);

    convertWethToEth(isEth, tokenContract, collateralAmount);
  }

  function payback(address borrowAsset, uint256 borrowAmount) external override payable {

    AaveInterface aave = AaveInterface(getAaveProvider().getLendingPool());
    AaveDataProviderInterface aaveData = getAaveDataProvider();

    bool isEth = borrowAsset == getEthAddr();
    address _token = isEth ? getWethAddr() : borrowAsset;

    TokenInterface tokenContract = TokenInterface(_token);

    (,, uint variableDebt, , , , , , ) = aaveData.getUserReserveData(_token, address(this));
    borrowAmount = borrowAmount == uint256(-1) ? variableDebt : borrowAmount;

    if (isEth) convertEthToWeth(isEth, tokenContract, borrowAmount);

    tokenContract.approve(address(aave), borrowAmount);

    aave.repay(_token, borrowAmount, 2, address(this));
  }
}
