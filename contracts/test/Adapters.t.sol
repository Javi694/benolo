// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {MorphoBlueAdapter} from "../src/adapters/MorphoBlueAdapter.sol";
import {PendlePTAdapter} from "../src/adapters/PendlePTAdapter.sol";
import {MockMorphoBlue} from "./mocks/MockMorphoBlue.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC4626Vault} from "./mocks/MockERC4626Vault.sol";
import {MarketParams} from "../lib/IMorphoBlueAdapterTypes.sol";

contract AdapterTest is Test {
    MockERC20 internal usdc;
    MockMorphoBlue internal morpho;
    MockERC4626Vault internal pendleVault;
    MorphoBlueAdapter internal morphoAdapter;
    PendlePTAdapter internal pendleAdapter;

    address internal vault = address(0xAAA);
    bytes32 internal morphoStrategyId = keccak256("MORPHO_BLUE_USDC");
    bytes32 internal pendleStrategyId = keccak256("PENDLE_GLP_PTL");

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);

        MarketParams memory params = MarketParams({
            loanToken: address(usdc),
            collateralToken: address(0),
            oracle: address(0),
            irm: address(0),
            lltv: 0
        });
        morpho = new MockMorphoBlue(params, address(usdc));
        pendleVault = new MockERC4626Vault(address(usdc));

        morphoAdapter = new MorphoBlueAdapter(address(usdc), morphoStrategyId, address(morpho), params, address(this));
        pendleAdapter = new PendlePTAdapter(address(usdc), pendleStrategyId, address(pendleVault), address(this));

        morphoAdapter.setAllowedVault(vault, true);
        pendleAdapter.setAllowedVault(vault, true);
    }

    function testMorphoDepositWithdraw() public {
        usdc.mint(vault, 1_000e6);

        uint256 beforeDeposit = usdc.balanceOf(vault);
        vm.startPrank(vault);
        usdc.approve(address(morphoAdapter), 500e6);
        morphoAdapter.deposit(500e6);
        vm.stopPrank();

        assertEq(beforeDeposit - usdc.balanceOf(vault), 500e6, "deposit debit");

        assertEq(morphoAdapter.totalShares(), 500e6, "shares minted");
        assertGt(morphoAdapter.totalAssets(), 0, "assets tracked");

        vm.startPrank(vault);
        morphoAdapter.withdraw(250e6, vault);
        vm.stopPrank();

        assertEq(usdc.balanceOf(vault) - (beforeDeposit - 500e6), 250e6, "principal returned");
    }

    function testPendleDepositWithdraw() public {
        usdc.mint(vault, 500e6);

        uint256 before = usdc.balanceOf(vault);
        vm.startPrank(vault);
        usdc.approve(address(pendleAdapter), 500e6);
        pendleAdapter.deposit(500e6);
        vm.stopPrank();

        assertEq(pendleAdapter.totalShares(), 500e6, "shares minted");

        vm.startPrank(vault);
        pendleAdapter.withdraw(200e6, vault);
        vm.stopPrank();

        assertEq(usdc.balanceOf(vault) - (before - 500e6), 200e6, "withdrawn assets");
    }
}
