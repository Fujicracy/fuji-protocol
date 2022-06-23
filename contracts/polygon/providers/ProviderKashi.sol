// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/IProvider.sol";
import "../../interfaces/IUnwrapper.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IVaultControl.sol";
import "../../interfaces/IWETH.sol";
import "../../interfaces/aave/IAaveDataProvider.sol";
import "../../interfaces/aave/IAaveLendingPool.sol";
import "../../interfaces/IFujiKashiMapping.sol";
import "../../interfaces/kashi/IKashiPair.sol";
import "../../interfaces/kashi/IBentoBox.sol";
import "../../libraries/LibUniversalERC20.sol";

contract ProviderKashi is IProvider {
  using LibUniversalERC20 for IERC20;

  function _getKashiMapping() internal pure returns (IFujiKashiMapping) {
    return IFujiKashiMapping(0xb41fD44a65BB5e974726cFe061B6d20f224b2671);
  }

  function _getWmaticAddr() internal pure returns (address) {
    return 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
  }

  function _getMaticAddr() internal pure returns (address) {
    return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
  }

  function _getUnwrapper() internal pure returns (address) {
    return 0x03E074BB834F7C4940dFdE8b29e63584b3dE3a87;
  }

  function _getBentoBox() internal pure returns (IBentoBox) {
    return IBentoBox(0x0319000133d3AdA02600f0875d2cf03D442C3367);
  }

  function _getKashiPair(address _vault) internal view returns (IKashiPair) {
    IVaultControl.VaultAssets memory vAssets = IVaultControl(_vault).vAssets();
    IFujiKashiMapping kashiMapper = _getKashiMapping();
    return IKashiPair(kashiMapper.addressMapping(vAssets.collateralAsset, vAssets.borrowAsset));
  }

  /**
   * @dev Returns the current borrowing rate (APR) of a borrowing asset, in ray(1e27).
   * @dev First argument '_collateralAsset' is required to get kashi market from mapping.
   * @dev Kashi provider required a different function signature for getBorrowRateFor()
   * @param _collateralAsset required to get kashi market from mapping.
   * @param _borrowAsset to query the borrowing rate.
   */
  function getBorrowRateFor(address _collateralAsset, address _borrowAsset)
    external
    view
    returns (uint256)
  {
    IFujiKashiMapping kashiMapper = _getKashiMapping();
    IKashiPair kashiPair = IKashiPair(kashiMapper.addressMapping(_collateralAsset, _borrowAsset));

    (uint256 interestPerSecond, , ) = kashiPair.accrueInfo();
    return interestPerSecond * 52 weeks * 10**9;
  }

  /**
   * @dev Not implemented, see 'getBorrowRateFor(address, address)'
   */
  function getBorrowRateFor(address) external pure override returns (uint256) {
    revert("Refer to KashiProvider.getBorrowRateFor(address, address)");
  }

  /**
   * @dev Return borrow balance of 'borrowAsset' of caller vault address.
   * @dev Caller must be a vault address.
   * @dev First address argument is not needed.
   */
  function getBorrowBalance(address) external view override returns (uint256 amount) {
    IKashiPair kashiPair = _getKashiPair(msg.sender);
    uint256 part = kashiPair.userBorrowPart(msg.sender);

    (uint128 elastic, uint128 base) = kashiPair.totalBorrow();

    amount = base > 0 ? (part * elastic) / base : 0;
  }

  /**
   * @dev Return borrow balance of 'borrowAsset' of any vault address.
   * @dev First address argument is not needed.
   * @param _who Must be a vault address.
   */
  function getBorrowBalanceOf(address, address _who)
    external
    view
    override
    returns (uint256 amount)
  {
    IKashiPair kashiPair = _getKashiPair(_who);

    uint256 part = kashiPair.userBorrowPart(_who);
    (uint128 elastic, uint128 base) = kashiPair.totalBorrow();

    amount = base > 0 ? (part * elastic) / base : 0;
  }

  /**
   * @dev Return deposit balance of 'collateralAsset' defined in caller vault address.
   * @dev Caller must be a vault address.
   * @param _asset token address to query the balance.
   */
  function getDepositBalance(address _asset) external view override returns (uint256) {
    IKashiPair kashiPair = _getKashiPair(msg.sender);
    IBentoBox bentoBox = _getBentoBox();

    uint256 share = kashiPair.userCollateralShare(msg.sender);
    return bentoBox.toAmount(_asset, share, false);
  }

  /**
   * @dev Deposit ETH/ERC20_Token.
   * @param _asset token address to deposit.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount token amount to deposit.
   */
  function deposit(address _asset, uint256 _amount) external payable override {
    IKashiPair kashiPair = _getKashiPair(address(this));
    IBentoBox bentoBox = _getBentoBox();

    bool isNative = _asset == _getMaticAddr();
    address _tokenAddr = isNative ? _getWmaticAddr() : _asset;

    // convert ETH to WETH
    if (isNative) IWETH(_tokenAddr).deposit{ value: _amount }();

    IERC20(_tokenAddr).univApprove(address(bentoBox), _amount);
    (, uint256 share) = bentoBox.deposit(_tokenAddr, address(this), address(kashiPair), _amount, 0);
    kashiPair.addCollateral(address(this), true, share);
  }

  /**
   * @dev Borrow ETH/ERC20_Token.
   * @param _asset token address to borrow.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
   * @param _amount token amount to borrow.
   */
  function borrow(address _asset, uint256 _amount) external payable override {
    IKashiPair kashiPair = _getKashiPair(address(this));
    IBentoBox bentoBox = _getBentoBox();

    bool isNative = _asset == _getMaticAddr();
    address _tokenAddr = isNative ? _getWmaticAddr() : _asset;

    (, uint256 share) = kashiPair.borrow(address(this), _amount + 1);
    (_amount, ) = bentoBox.withdraw(_tokenAddr, address(this), address(this), 0, share);

    // convert WETH to ETH
    if (isNative) {
      address unwrapper = _getUnwrapper();
      IERC20(_tokenAddr).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Withdraw ETH/ERC20_Token.
   * @param _asset token address to withdraw.
   * @param _amount token amount to withdraw.
   */
  function withdraw(address _asset, uint256 _amount) external payable override {
    IKashiPair kashiPair = _getKashiPair(address(this));
    IBentoBox bentoBox = _getBentoBox();

    bool isNative = _asset == _getMaticAddr();
    address _tokenAddr = isNative ? _getWmaticAddr() : _asset;

    uint256 share = bentoBox.toShare(_tokenAddr, _amount, false);
    kashiPair.removeCollateral(address(this), share);
    (_amount, ) = bentoBox.withdraw(_tokenAddr, address(this), address(this), 0, share);

    // convert WETH to ETH
    if (isNative) {
      address unwrapper = _getUnwrapper();
      IERC20(_tokenAddr).univTransfer(payable(unwrapper), _amount);
      IUnwrapper(unwrapper).withdraw(_amount);
    }
  }

  /**
   * @dev Payback borrowed ETH/ERC20_Token.
   * @param _asset token address to payback.
   * @param _amount token amount to payback.
   */

  function payback(address _asset, uint256 _amount) external payable override {
    IKashiPair kashiPair = _getKashiPair(address(this));
    IBentoBox bentoBox = _getBentoBox();

    bool isNative = _asset == _getMaticAddr();
    address _tokenAddr = isNative ? _getWmaticAddr() : _asset;

    // convert ETH to WETH
    if (isNative) IWETH(_tokenAddr).deposit{ value: _amount }();

    IERC20(_tokenAddr).univApprove(address(bentoBox), _amount);
    (, uint256 share) = bentoBox.deposit(_tokenAddr, address(this), address(kashiPair), _amount, 0);
    _amount = bentoBox.toAmount(_tokenAddr, share, false);

    kashiPair.accrue();
    (uint128 elastic, uint128 base) = kashiPair.totalBorrow();
    uint256 part = (_amount * base) / elastic;

    kashiPair.repay(address(this), true, part);
  }
}
