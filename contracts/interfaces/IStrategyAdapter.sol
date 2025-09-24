// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStrategyAdapter {
    function asset() external view returns (address);

    function strategyId() external view returns (bytes32);

    function deposit(uint256 amount) external returns (uint256 sharesMinted);

    function withdraw(uint256 shares, address recipient) external returns (uint256 assetsReturned);

    function withdrawAll(address recipient) external returns (uint256 assetsReturned);

    function unrealisedBalance() external view returns (uint256);
}
