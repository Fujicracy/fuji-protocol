// SPDX-License-Identifier: MIT
pragma solidity 0.7.4;

interface IFlashLoanReceiver {
  function executeOperation(address[] calldata assets, uint256[] calldata amounts, uint256[] calldata premiums, address initiator, bytes calldata params) external returns (bool);
}

interface IArbitrageStrategy {
     function arbitrage() external payable;
     function whitelistTrader(address _trader) external;
}

interface IERC20 {
  function deposit() external payable;
  function withdraw(uint256) external;
  function approve(address guy, uint256 wad) external returns (bool);
  function transfer(address dst, uint wad) external returns (bool);
  function transferFrom(address src,address dst,uint256 wad) external returns (bool);
  function balanceOf(address guy) external returns(uint256);

}

interface ILendingPool{
  function flashLoan(address receiverAddress,address[] calldata assets,uint256[] calldata amounts,uint256[] calldata modes,address onBehalfOf,bytes calldata params,uint16 referralCode) external;
}

contract FlasherBase is IFlashLoanReceiver {

  address constant LENDING_POOL = 0x9FE532197ad76c5a68961439604C037EB79681F0;

  //Temp state variables
  address private protocol00;
  address private tempAsset;
  uint256 private tempAmount;
  address private protocol01;

  function executeOperation( //This Operation is called and required by Aave FlashLoan
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external override returns (bool) {

    //TODO
    //

    return true;
  }

  receive() external payable {
  }

  function flashloancall( //Functional Call for the FujiController
    address _borrowAsset,
    uint256 _amount0,
    address _collateralasset,
    uint256 _amount1,
    address _fromProtocol,
    address _toProtocol
   ) external {

    ILendingPool aaveLp = ILendingPool(LENDING_POOL); //Initialize Instance of Aave Lending Pool

    //Assign temporary variables to execute when "Execute Operation Function" is called by Aave
    tempAsset = _collateralasset;
    tempAmount = _amount1;
    protocol00 = _fromProtocol;
    protocol01 = _toProtocol;

    //Passing arguments to construct Aave flashloan -limited to 1 asset type for now.
    address receiverAddress = address(this);
    address[] memory assets = new address[](1);
    assets[0] = address(_borrowAsset);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = _amount0;

    // 0 = no debt, 1 = stable, 2 = variable
    uint256[] memory modes = new uint256[](1);
    modes[0] = 0;

    address onBehalfOf = address(this);
    bytes memory params = "";
    uint16 referralCode = 0;

    //Aave Flashloan initiated.
    aaveLp.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
          );
  }

}
