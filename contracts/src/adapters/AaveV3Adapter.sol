// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../../lib/IERC20.sol";
import {SafeERC20} from "../../lib/SafeERC20.sol";
import {AbstractHoldingAdapter} from "./AbstractHoldingAdapter.sol";

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IAaveAToken {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title AaveV3Adapter
 * @notice Intègre le flux supply/withdraw du Pool Aave v3 (Base) pour les vaults Benolo.
 *         L’adaptateur garde une comptabilité en parts et ne peut être appelé que par des vaults autorisés.
 */
contract AaveV3Adapter is AbstractHoldingAdapter {
    using SafeERC20 for IERC20;

    IAavePool public immutable pool;
    IAaveAToken public immutable aToken;
    uint16 public immutable referralCode;

    constructor(
        address asset_,
        bytes32 strategyId_,
        address pool_,
        address aToken_,
        uint16 referralCode_,
        address owner_
    ) AbstractHoldingAdapter(asset_, strategyId_) {
        require(pool_ != address(0), "AaveAdapter: pool zero");
        require(aToken_ != address(0), "AaveAdapter: aToken zero");
        pool = IAavePool(pool_);
        aToken = IAaveAToken(aToken_);
        referralCode = referralCode_;

        if (owner_ != address(0) && owner_ != msg.sender) {
            _transferOwnership(owner_);
        }
    }

    function totalAssets() public view override returns (uint256) {
        // Solde local (en cas de retrait partiel) + solde aToken (principal + intérêts).
        uint256 baseBalance = super.totalAssets();
        uint256 aTokenBalance = aToken.balanceOf(address(this));
        return baseBalance + aTokenBalance;
    }

    function _afterDeposit(address /*caller*/, uint256 amount) internal override {
        IERC20 underlying = _assetToken();

        // Réinitialise l’approbation pour éviter les résidus.
        underlying.safeApprove(address(pool), 0);
        underlying.safeApprove(address(pool), amount);

        pool.supply(address(underlying), amount, address(this), referralCode);
    }

    function _beforeWithdraw(address /*caller*/, uint256 assets) internal override {
        IERC20 underlying = _assetToken();
        uint256 withdrawn = pool.withdraw(address(underlying), assets, address(this));
        require(withdrawn >= assets, "AaveAdapter: short withdraw");
    }
}
