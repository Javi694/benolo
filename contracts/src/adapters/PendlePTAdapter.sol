// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../../lib/IERC20.sol";
import {SafeERC20} from "../../lib/SafeERC20.sol";
import {AbstractHoldingAdapter} from "./AbstractHoldingAdapter.sol";
import {IERC4626Minimal} from "../../lib/IERC4626Minimal.sol";

/**
 * @title PendlePTAdapter
 * @notice Adapte un coffre ERC-4626 (ex: wrapper Pendle PT) pour les vaults Benolo. Les fonds sont déposés
 *         dans la stratégie 4626 et convertis en USDC à la sortie.
 */
contract PendlePTAdapter is AbstractHoldingAdapter {
    using SafeERC20 for IERC20;

    IERC4626Minimal public immutable yieldVault;

    constructor(
        address asset_,
        bytes32 strategyId_,
        address yieldVault_,
        address owner_
    ) AbstractHoldingAdapter(asset_, strategyId_) {
        require(yieldVault_ != address(0), "PendleAdapter: vault zero");
        yieldVault = IERC4626Minimal(yieldVault_);
        require(yieldVault.asset() == asset_, "PendleAdapter: asset mismatch");

        if (owner_ != address(0) && owner_ != msg.sender) {
            _transferOwnership(owner_);
        }
    }

    function totalAssets() public view override returns (uint256) {
        uint256 local = _assetToken().balanceOf(address(this));
        uint256 shares = yieldVault.balanceOf(address(this));
        if (shares == 0) {
            return local;
        }
        uint256 vaultAssets = yieldVault.convertToAssets(shares);
        return local + vaultAssets;
    }

    function _afterDeposit(address /*caller*/, uint256 amount) internal override {
        IERC20 underlying = _assetToken();
        underlying.safeApprove(address(yieldVault), 0);
        underlying.safeApprove(address(yieldVault), amount);

        uint256 mintedShares = yieldVault.deposit(amount, address(this));
        require(mintedShares > 0, "PendleAdapter: zero shares");
    }

    function _beforeWithdraw(address /*caller*/, uint256 assets) internal override {
        uint256 sharesNeeded = yieldVault.convertToShares(assets);
        uint256 sharesBalance = yieldVault.balanceOf(address(this));
        if (sharesNeeded > sharesBalance) {
            sharesNeeded = sharesBalance;
        }

        uint256 withdrawn = yieldVault.redeem(sharesNeeded, address(this), address(this));
        require(withdrawn >= assets, "PendleAdapter: withdraw short");
    }
}
