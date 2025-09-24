// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LeagueFactory} from "../src/LeagueFactory.sol";
import {LeagueVault} from "../src/LeagueVault.sol";
import {ILeagueFactory} from "../interfaces/ILeagueFactory.sol";
import {ILeagueVault} from "../interfaces/ILeagueVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {AbstractHoldingAdapter} from "../src/adapters/AbstractHoldingAdapter.sol";

contract TestHoldingAdapter is AbstractHoldingAdapter {
    constructor(address asset_, bytes32 strategyId_) AbstractHoldingAdapter(asset_, strategyId_) {}
}

contract LeagueLifecycleTest is Test {
    LeagueFactory public factory;
    LeagueVault public implementation;
    TestHoldingAdapter public adapter;
    MockERC20 public usdc;

    address public creator = address(0xC0DE);
    address public player1 = address(0xAAA1);
    address public player2 = address(0xAAA2);
    address public treasury = address(0xBEEF);

    bytes32 public strategyId = keccak256("AAVE_USDC_V3");
    uint256 public constant ENTRY = 100e6;
    uint256 private leagueNonce;

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        implementation = new LeagueVault();
        factory = new LeagueFactory(address(implementation));

        adapter = new TestHoldingAdapter(address(usdc), strategyId);
        factory.setStrategyAdapter(strategyId, address(adapter), true);
    }

    function testFullLifecycle() public {
        (LeagueVault vault, address vaultAddr) = _createLeague(500, 1000, true);

        usdc.mint(player1, ENTRY);
        usdc.mint(player2, ENTRY);

        vm.startPrank(player1);
        usdc.approve(vaultAddr, ENTRY);
        vault.deposit(ENTRY);
        vm.stopPrank();

        vm.startPrank(player2);
        usdc.approve(vaultAddr, ENTRY);
        vault.deposit(ENTRY);
        vm.stopPrank();

        vm.prank(creator);
        vault.lock();

        // Inject yield into the adapter (simulates protocol earnings).
        vm.prank(address(this));
        usdc.mint(address(adapter), 50e6);

        vm.prank(address(factory));
        vault.settle("{}");

        ILeagueVault.WinnerShare[] memory shares = new ILeagueVault.WinnerShare[](2);
        shares[0] = ILeagueVault.WinnerShare({account: player1, shareBps: 6000});
        shares[1] = ILeagueVault.WinnerShare({account: player2, shareBps: 4000});

        vm.prank(address(factory));
        vault.setWinners(shares);

        vm.prank(address(factory));
        vault.openClaims();

        (uint256 p1PrincipalClaim, uint256 p1YieldClaim) = vault.claimable(player1);
        assertEq(p1PrincipalClaim, ENTRY, "player1 principal claimable");
        assertEq(p1YieldClaim, 27e6, "player1 yield claimable");

        uint256 p1Before = usdc.balanceOf(player1);
        vm.prank(player1);
        vault.claim();
        uint256 p1After = usdc.balanceOf(player1);

        uint256 p2Before = usdc.balanceOf(player2);
        vm.prank(player2);
        vault.claim();
        uint256 p2After = usdc.balanceOf(player2);

        assertEq(p1After - p1Before, ENTRY + 27e6, "player1 payout");
        assertEq(p2After - p2Before, ENTRY + 18e6, "player2 payout");

        (uint256 p1PrincipalLeft, uint256 p1YieldLeft) = vault.claimable(player1);
        assertEq(p1PrincipalLeft, 0, "player1 principal remaining");
        assertEq(p1YieldLeft, 0, "player1 yield remaining");

        vm.prank(address(factory));
        vault.claimCommission(treasury);
        assertEq(usdc.balanceOf(treasury), 5e6, "commission to treasury");

        // Second claim should revert because nothing left.
        vm.expectRevert("LeagueVault: nothing");
        vm.prank(player1);
        vault.claim();
    }

    function testEarlyExitPenaltyFlowsToWinner() public {
        (LeagueVault vault, address vaultAddr) = _createLeague(500, 1000, true);

        usdc.mint(player1, ENTRY);
        usdc.mint(player2, ENTRY);

        vm.startPrank(player1);
        usdc.approve(vaultAddr, ENTRY);
        vault.deposit(ENTRY);
        vm.stopPrank();

        vm.startPrank(player2);
        usdc.approve(vaultAddr, ENTRY);
        vault.deposit(ENTRY);
        vm.stopPrank();

        // Player1 quitte la ligue avant le démarrage, pénalité 5%.
        vm.prank(player1);
        vault.earlyExit(ENTRY);

        vm.prank(creator);
        vault.lock();

        vm.prank(address(factory));
        vault.settle("{}");

        (uint256 p1PrincipalBefore, uint256 p1YieldBefore) = vault.claimable(player1);
        assertEq(p1PrincipalBefore, 0);
        assertEq(p1YieldBefore, 0);

        ILeagueVault.WinnerShare[] memory shares = new ILeagueVault.WinnerShare[](1);
        shares[0] = ILeagueVault.WinnerShare({account: player2, shareBps: 10_000});
        vm.prank(address(factory));
        vault.setWinners(shares);
        vm.prank(address(factory));
        vault.openClaims();

        (uint256 p2PrincipalClaim, uint256 p2YieldClaim) = vault.claimable(player2);
        assertEq(p2PrincipalClaim, ENTRY);
        assertEq(p2YieldClaim, 4_500_000);

        uint256 balanceBefore = usdc.balanceOf(player2);
        vm.prank(player2);
        vault.claim();
        uint256 balanceAfter = usdc.balanceOf(player2);

        // Payout = principal (100) + pénalité nette (4.5 après commission 10%).
        assertEq(balanceAfter - balanceBefore, ENTRY + 4_500_000, "player2 total");

        vm.prank(address(factory));
        vault.claimCommission(treasury);
        assertEq(usdc.balanceOf(treasury), 500_000, "commission from penalty");
    }

    function testEmergencyFlowReturnsPrincipal() public {
        (LeagueVault vault, address vaultAddr) = _createLeague(0, 1000, false);

        usdc.mint(player1, ENTRY);
        usdc.mint(player2, ENTRY);

        vm.prank(player1);
        usdc.approve(vaultAddr, ENTRY);
        vm.prank(player1);
        vault.deposit(ENTRY);

        vm.prank(player2);
        usdc.approve(vaultAddr, ENTRY);
        vm.prank(player2);
        vault.deposit(ENTRY);

        vm.prank(creator);
        vault.lock();

        // Benolo active l'urgence (factory) et retire du strategy adapter.
        vm.prank(address(factory));
        vault.activateEmergency();

        vm.prank(address(factory));
        vault.resolveEmergency();

        ILeagueVault.WinnerShare[] memory shares = new ILeagueVault.WinnerShare[](2);
        shares[0] = ILeagueVault.WinnerShare({account: player1, shareBps: 5_000});
        shares[1] = ILeagueVault.WinnerShare({account: player2, shareBps: 5_000});
        vm.prank(address(factory));
        vault.setWinners(shares);
        vm.prank(address(factory));
        vault.openClaims();

        uint256 p1Before = usdc.balanceOf(player1);
        (uint256 p1PrincipalClaimable, uint256 p1YieldClaimable) = vault.claimable(player1);
        assertEq(p1PrincipalClaimable, ENTRY, "player1 principal claimable after emergency");
        assertEq(p1YieldClaimable, 0, "player1 yield claimable after emergency");
        vm.prank(player1);
        vault.claim();
        uint256 p1After = usdc.balanceOf(player1);

        uint256 p2Before = usdc.balanceOf(player2);
        vm.prank(player2);
        vault.claim();
        uint256 p2After = usdc.balanceOf(player2);

        assertEq(p1After - p1Before, ENTRY, "player1 principal only");
        assertEq(p2After - p2Before, ENTRY, "player2 principal only");
    }

    function testSettleWithoutYieldHasNoCommission() public {
        (LeagueVault vault, address vaultAddr) = _createLeague(0, 1500, false);

        usdc.mint(player1, ENTRY);
        usdc.mint(player2, ENTRY);

        vm.startPrank(player1);
        usdc.approve(vaultAddr, ENTRY);
        vault.deposit(ENTRY);
        vm.stopPrank();

        vm.startPrank(player2);
        usdc.approve(vaultAddr, ENTRY);
        vault.deposit(ENTRY);
        vm.stopPrank();

        vm.prank(creator);
        vault.lock();

        vm.prank(address(factory));
        vault.settle("{}");

        ILeagueVault.WinnerShare[] memory shares = new ILeagueVault.WinnerShare[](2);
        shares[0] = ILeagueVault.WinnerShare({account: player1, shareBps: 6_000});
        shares[1] = ILeagueVault.WinnerShare({account: player2, shareBps: 4_000});
        vm.prank(address(factory));
        vault.setWinners(shares);
        vm.prank(address(factory));
        vault.openClaims();

        vm.prank(player1);
        vault.claim();
        vm.prank(player2);
        vault.claim();

        vm.expectRevert("LeagueVault: no commission");
        vm.prank(address(factory));
        vault.claimCommission(treasury);
    }

    function _createLeague(uint16 exitPenaltyBps, uint16 commissionBps, bool canEarlyExit)
        internal
        returns (LeagueVault vault, address vaultAddr)
    {
        ILeagueFactory.CreateParams memory params;
        params.leagueId = keccak256(abi.encodePacked("league", leagueNonce++));
        params.creator = creator;
        params.asset = address(usdc);
        params.entryAmount = ENTRY;
        params.exitPenaltyBps = exitPenaltyBps;
        params.commissionBps = commissionBps;
        params.strategyId = strategyId;
        params.canEarlyExit = canEarlyExit;

        vm.prank(creator);
        vaultAddr = factory.createLeague(params);
        vault = LeagueVault(vaultAddr);
        adapter.setAllowedVault(vaultAddr, true);
    }
}
