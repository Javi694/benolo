// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILeagueVault {
    enum Status {
        CREATED,
        FUNDING,
        LOCKED,
        INVESTED,
        SETTLING,
        DISTRIBUTED,
        EMERGENCY
    }

    struct WinnerShare {
        address account;
        uint16 shareBps;
    }

    struct VaultConfig {
        bytes32 leagueId;
        address asset;
        address creator;
        bytes32 strategyId;
        uint256 entryAmount;
        uint16 exitPenaltyBps;
        uint16 commissionBps;
        bool canEarlyExit;
    }

    event Deposited(address indexed sender, uint256 amount);
    event EarlyExit(address indexed sender, uint256 refunded, uint256 penalty);
    event Locked(uint256 totalPrincipal);
    event Harvested(uint256 yieldAmount);
    event Settled(uint256 principalReturned, uint256 yieldPool, uint256 commission);
    event WinnersSet(address indexed setter, uint256 winnersCount);
    event ClaimsOpened();
    event Claimed(address indexed account, uint256 principal, uint256 yield);
    event CommissionClaimed(address indexed to, uint256 amount);
    event EmergencyActivated();
    event EmergencyResolved();

    function initialize(VaultConfig calldata config) external;

    function deposit(uint256 amount) external;

    function earlyExit(uint256 amount) external;

    function lock() external;

    function harvest() external;

    function settle(bytes calldata settleData) external;

    function setWinners(WinnerShare[] calldata shares) external;

    function openClaims() external;

    function claim() external;

    function claimCommission(address to) external;

    function activateEmergency() external;

    function resolveEmergency() external;

    function status() external view returns (Status);

    function totalDeposited() external view returns (uint256);

    function totalYield() external view returns (uint256);

    function commissionDue() external view returns (uint256);

    function claimable(address account) external view returns (uint256 principalOwed, uint256 yieldOwed);
}
