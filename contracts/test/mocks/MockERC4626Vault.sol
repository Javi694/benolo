// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC4626Minimal} from "../../lib/IERC4626Minimal.sol";
import {IERC20} from "../../lib/IERC20.sol";

contract MockERC4626Vault is IERC4626Minimal {
    IERC20 public immutable underlying;
    uint256 public totalShares;
    mapping(address => uint256) public shareBalance;

    constructor(address asset_) {
        underlying = IERC20(asset_);
    }

    function asset() external view override returns (address) {
        return address(underlying);
    }

    function totalAssets() public view override returns (uint256) {
        return underlying.balanceOf(address(this));
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        if (totalShares == 0) {
            return shares;
        }
        return (shares * totalAssets()) / totalShares;
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {
        if (totalShares == 0) {
            return assets;
        }
        return (assets * totalShares) / totalAssets();
    }

    function deposit(uint256 assets, address receiver) external override returns (uint256) {
        require(underlying.transferFrom(msg.sender, address(this), assets), "transfer in");
        uint256 shares = convertToShares(assets);
        if (totalShares == 0) {
            shares = assets;
        }
        totalShares += shares;
        shareBalance[receiver] += shares;
        return shares;
    }

    function mint(uint256 shares, address receiver) external override returns (uint256) {
        uint256 assets = convertToAssets(shares);
        require(underlying.transferFrom(msg.sender, address(this), assets), "transfer in");
        totalShares += shares;
        shareBalance[receiver] += shares;
        return assets;
    }

    function withdraw(uint256 assets, address receiver, address owner) external override returns (uint256) {
        uint256 shares = convertToShares(assets);
        return redeem(shares, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public override returns (uint256) {
        require(shareBalance[owner] >= shares, "shares");
        uint256 assets = convertToAssets(shares);
        shareBalance[owner] -= shares;
        totalShares -= shares;
        require(underlying.transfer(receiver, assets), "transfer out");
        return assets;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return shareBalance[account];
    }
}
