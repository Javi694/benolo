// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMorpho, MarketParams, Market, Position, Id} from "../../lib/IMorphoBlueAdapterTypes.sol";
import {IERC20} from "../../lib/IERC20.sol";

contract MockMorphoBlue is IMorpho {
    MarketParams public params;
    IERC20 public immutable asset;

    Market internal _market;
    mapping(address => Position) internal _positions;

    constructor(MarketParams memory params_, address asset_) {
        params = params_;
        asset = IERC20(asset_);
    }

    function market(Id) external view override returns (Market memory) {
        return _market;
    }

    function position(Id, address user) external view override returns (Position memory) {
        return _positions[user];
    }

    function supply(
        MarketParams memory,
        uint256 assets,
        uint256,
        address onBehalf,
        bytes memory
    ) external override returns (uint256 assetsSupplied, uint256 sharesSupplied) {
        require(asset.transferFrom(msg.sender, address(this), assets), "transfer failed");
        Position storage p = _positions[onBehalf];
        uint256 shares = assets;
        p.supplyShares += shares;
        _market.totalSupplyAssets = uint128(uint256(_market.totalSupplyAssets) + assets);
        _market.totalSupplyShares = uint128(uint256(_market.totalSupplyShares) + shares);
        return (assets, shares);
    }

    function withdraw(
        MarketParams memory,
        uint256 assets,
        uint256,
        address onBehalf,
        address receiver
    ) external override returns (uint256 assetsWithdrawn, uint256 sharesWithdrawn) {
        Position storage p = _positions[onBehalf];
        require(p.supplyShares >= assets, "insufficient shares");
        p.supplyShares -= assets;
        _market.totalSupplyAssets = uint128(uint256(_market.totalSupplyAssets) - assets);
        _market.totalSupplyShares = uint128(uint256(_market.totalSupplyShares) - assets);
        require(asset.transfer(receiver, assets), "transfer out failed");
        return (assets, assets);
    }
}
