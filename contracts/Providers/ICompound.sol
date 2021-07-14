import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IGenCToken is IERC20 {
  function redeem(uint256) external returns (uint256);

  function redeemUnderlying(uint256) external returns (uint256);

  function borrow(uint256 borrowAmount) external returns (uint256);

  function exchangeRateCurrent() external returns (uint256);

  function exchangeRateStored() external view returns (uint256);

  function borrowRatePerBlock() external view returns (uint256);

  function balanceOfUnderlying(address owner) external returns (uint256);

  function borrowBalanceCurrent(address account) external returns (uint256);

  function borrowBalanceStored(address account) external view returns (uint256);
}

interface ICErc20 is IGenCToken {
  function mint(uint256) external returns (uint256);

  function repayBorrow(uint256 repayAmount) external returns (uint256);

  function repayBorrowBehalf(address borrower, uint256 repayAmount) external returns (uint256);
}

interface ICEth is IGenCToken {
  function mint() external payable;

  function repayBorrow() external payable;

  function repayBorrowBehalf(address borrower) external payable;
}

interface IComptroller {
  function markets(address) external returns (bool, uint256);

  function enterMarkets(address[] calldata) external returns (uint256[] memory);

  function exitMarket(address cTokenAddress) external returns (uint256);

  function cTokensByUnderlying(address underlyingAsset) external view returns (address);
}
