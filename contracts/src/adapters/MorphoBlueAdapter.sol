// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../../lib/IERC20.sol";
import {SafeERC20} from "../../lib/SafeERC20.sol";
import {AbstractHoldingAdapter} from "./AbstractHoldingAdapter.sol";
import {IMorpho, MarketParams, Market, Position, Id} from "../../lib/IMorphoBlueAdapterTypes.sol";

/**
 * @title MorphoBlueAdapter
 * @notice Fournit une intégration minimaliste avec Morpho Blue : les USDC sont fournis sur un marché donné et
 *         retirés lors des settlements. Chaque vault autorisé possède ses propres parts comptables.
 */
contract MorphoBlueAdapter is AbstractHoldingAdapter {
    using SafeERC20 for IERC20;

    IMorpho public immutable morpho;
    MarketParams public marketParams;
    bytes32 public marketId;

    constructor(
        address asset_,
        bytes32 strategyId_,
        address morpho_,
        MarketParams memory params_,
        address owner_
    ) AbstractHoldingAdapter(asset_, strategyId_) {
        require(morpho_ != address(0), "MorphoAdapter: morpho zero");
        morpho = IMorpho(morpho_);
        marketParams = params_;
        marketId = _computeMarketId(params_);

        if (owner_ != address(0) && owner_ != msg.sender) {
            _transferOwnership(owner_);
        }
    }

    function totalAssets() public view override returns (uint256) {
        uint256 local = _assetToken().balanceOf(address(this));
        Market memory marketData = morpho.market(Id.wrap(marketId));
        if (marketData.totalSupplyShares == 0) {
            return local;
        }

        Position memory position = morpho.position(Id.wrap(marketId), address(this));
        if (position.supplyShares == 0) {
            return local;
        }

        uint256 assets = (position.supplyShares * uint256(marketData.totalSupplyAssets))
            / uint256(marketData.totalSupplyShares);
        return local + assets;
    }

    function _afterDeposit(address /*caller*/, uint256 amount) internal override {
        IERC20 underlying = _assetToken();
        underlying.safeApprove(address(morpho), 0);
        underlying.safeApprove(address(morpho), amount);

        (uint256 supplied,) = morpho.supply(marketParams, amount, 0, address(this), "");
        require(supplied >= amount, "MorphoAdapter: supply short");
    }

    function _beforeWithdraw(address /*caller*/, uint256 assets) internal override {
        IERC20 underlying = _assetToken();
        (uint256 withdrawn,) = morpho.withdraw(marketParams, assets, 0, address(this), address(this));
        require(withdrawn >= assets, "MorphoAdapter: withdraw short");
        underlying.safeApprove(address(morpho), 0);
    }

    function _computeMarketId(MarketParams memory params) internal pure returns (bytes32) {
        return keccak256(abi.encode(params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv));
    }
}
