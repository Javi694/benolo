// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../../lib/IERC20.sol";
import {SafeERC20} from "../../lib/SafeERC20.sol";
import {Ownable} from "../../lib/Ownable.sol";
import {IStrategyAdapter} from "../../interfaces/IStrategyAdapter.sol";

abstract contract AbstractHoldingAdapter is IStrategyAdapter, Ownable {
    using SafeERC20 for IERC20;

    IERC20 internal immutable _asset;
    bytes32 internal immutable _strategyId;

    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;
    mapping(address => bool) public isVaultAllowed;

    event VaultAllowlistUpdated(address indexed vault, bool allowed);

    constructor(address asset_, bytes32 strategyId_) {
        require(asset_ != address(0), "Adapter: asset");
        require(strategyId_ != bytes32(0), "Adapter: id");
        _asset = IERC20(asset_);
        _strategyId = strategyId_;
    }

    modifier onlyAllowedVault() {
        require(isVaultAllowed[msg.sender], "Adapter: vault not allowed");
        _;
    }

    function setAllowedVault(address vault, bool allowed) external onlyOwner {
        require(vault != address(0), "Adapter: vault zero");
        isVaultAllowed[vault] = allowed;
        emit VaultAllowlistUpdated(vault, allowed);
    }

    function deposit(uint256 amount) external override onlyAllowedVault returns (uint256 sharesMinted) {
        require(amount > 0, "Adapter: zero deposit");

        uint256 assetsBefore = totalAssets();
        uint256 totalSharesBefore = totalShares;

        _asset.safeTransferFrom(msg.sender, address(this), amount);
        _afterDeposit(msg.sender, amount);

        if (totalSharesBefore == 0 || assetsBefore == 0) {
            sharesMinted = amount;
        } else {
            sharesMinted = (amount * totalSharesBefore) / assetsBefore;
        }

        require(sharesMinted > 0, "Adapter: shares");

        totalShares = totalSharesBefore + sharesMinted;
        sharesOf[msg.sender] += sharesMinted;

        return sharesMinted;
    }

    function withdraw(uint256 shares, address recipient) public override onlyAllowedVault returns (uint256 assets) {
        require(shares > 0, "Adapter: zero shares");
        require(recipient != address(0), "Adapter: zero recipient");

        uint256 accountShares = sharesOf[msg.sender];
        require(accountShares >= shares, "Adapter: insufficient shares");

        uint256 totalSharesBefore = totalShares;
        uint256 assetsBefore = totalAssets();
        require(totalSharesBefore > 0 && assetsBefore > 0, "Adapter: empty");

        assets = (shares * assetsBefore) / totalSharesBefore;
        require(assets > 0, "Adapter: zero assets");

        sharesOf[msg.sender] = accountShares - shares;
        totalShares = totalSharesBefore - shares;

        _beforeWithdraw(msg.sender, assets);
        _asset.safeTransfer(recipient, assets);
    }

    function withdrawAll(address recipient) external override onlyAllowedVault returns (uint256 assets) {
        uint256 shares = sharesOf[msg.sender];
        return withdraw(shares, recipient);
    }

    function unrealisedBalance() public view override returns (uint256) {
        return totalAssets();
    }

    function totalAssets() public view virtual returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    function asset() external view override returns (address) {
        return address(_asset);
    }

    function strategyId() external view override returns (bytes32) {
        return _strategyId;
    }

    function _assetToken() internal view returns (IERC20) {
        return _asset;
    }

    function _afterDeposit(address caller, uint256 amount) internal virtual {}

    function _beforeWithdraw(address caller, uint256 assets) internal virtual {}
}
