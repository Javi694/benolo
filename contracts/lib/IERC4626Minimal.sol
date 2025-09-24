// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC4626Minimal {
    function asset() external view returns (address);

    function totalAssets() external view returns (uint256);

    function convertToAssets(uint256 shares) external view returns (uint256);

    function convertToShares(uint256 assets) external view returns (uint256);

    function deposit(uint256 assets, address receiver) external returns (uint256);

    function mint(uint256 shares, address receiver) external returns (uint256);

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256);

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256);

    function balanceOf(address account) external view returns (uint256);
}
