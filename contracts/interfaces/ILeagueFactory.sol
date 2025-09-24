// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILeagueFactory {
    struct CreateParams {
        bytes32 leagueId;
        address creator;
        address asset;
        uint256 entryAmount;
        uint16 exitPenaltyBps;
        uint16 commissionBps;
        bytes32 strategyId;
        bool canEarlyExit;
    }

    event LeagueCreated(bytes32 indexed leagueId, address indexed vault, address indexed creator);
    event StrategyRegistryUpdated(bytes32 indexed strategyId, address adapter, bool enabled);

    function createLeague(CreateParams calldata params) external returns (address vault);

    function implementation() external view returns (address);

    function getStrategyAdapter(bytes32 strategyId) external view returns (address adapter, bool enabled);

    function setStrategyAdapter(bytes32 strategyId, address adapter, bool enabled) external;
}
