// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "../lib/Clones.sol";
import {Ownable} from "../lib/Ownable.sol";
import {ILeagueFactory} from "../interfaces/ILeagueFactory.sol";
import {ILeagueVault} from "../interfaces/ILeagueVault.sol";

interface IAllowlistAdapter {
    function setAllowedVault(address vault, bool allowed) external;
}

contract LeagueFactory is ILeagueFactory, Ownable {
    struct StrategyInfo {
        address adapter;
        bool enabled;
    }

    address public vaultImplementation;
    uint16 public constant MAX_EXIT_PENALTY_BPS = 10000;
    uint16 public constant MAX_COMMISSION_BPS = 2000; // 20%

    mapping(bytes32 => StrategyInfo) private _strategies;
    mapping(bytes32 => address) public vaultByLeagueId;

    event VaultImplementationUpdated(address indexed newImplementation);

    constructor(address _implementation) {
        require(_implementation != address(0), "LeagueFactory: impl=0");
        vaultImplementation = _implementation;
        emit VaultImplementationUpdated(_implementation);
    }

    function setVaultImplementation(address _implementation) external onlyOwner {
        require(_implementation != address(0), "LeagueFactory: impl=0");
        vaultImplementation = _implementation;
        emit VaultImplementationUpdated(_implementation);
    }

    function createLeague(CreateParams calldata params) external override returns (address vault) {
        require(vaultImplementation != address(0), "LeagueFactory: impl unset");
        require(vaultImplementation.code.length > 0, "LeagueFactory: impl code");
        require(params.leagueId != bytes32(0), "LeagueFactory: leagueId");
        require(params.creator != address(0), "LeagueFactory: creator");
        require(params.asset != address(0), "LeagueFactory: asset");
        require(params.exitPenaltyBps <= MAX_EXIT_PENALTY_BPS, "LeagueFactory: penalty");
        require(params.commissionBps <= MAX_COMMISSION_BPS, "LeagueFactory: commission");
        require(vaultByLeagueId[params.leagueId] == address(0), "LeagueFactory: exists");

        StrategyInfo memory info = _strategies[params.strategyId];
        require(info.enabled && info.adapter != address(0), "LeagueFactory: strategy");

        vault = Clones.clone(vaultImplementation);
        require(vault.code.length > 0, "LeagueFactory: clone code");

        ILeagueVault.VaultConfig memory config;
        config.leagueId = params.leagueId;
        config.asset = params.asset;
        config.creator = params.creator;
        config.strategyId = params.strategyId;
        config.entryAmount = params.entryAmount;
        config.exitPenaltyBps = params.exitPenaltyBps;
        config.commissionBps = params.commissionBps;
        config.canEarlyExit = params.canEarlyExit;

        ILeagueVault(vault).initialize(config);

        vaultByLeagueId[params.leagueId] = vault;

        // Tente d'ajouter automatiquement le vault à l'allowlist de la stratégie (si supportée).
        if (info.adapter != address(0)) {
            try IAllowlistAdapter(info.adapter).setAllowedVault(vault, true) {} catch {}
        }

        emit LeagueCreated(params.leagueId, vault, params.creator);
    }

    function implementation() external view override returns (address) {
        return vaultImplementation;
    }

    function getStrategyAdapter(bytes32 strategyId) external view override returns (address adapter, bool enabled) {
        StrategyInfo memory info = _strategies[strategyId];
        return (info.adapter, info.enabled);
    }

    function setStrategyAdapter(bytes32 strategyId, address adapter, bool enabled) external override onlyOwner {
        require(strategyId != bytes32(0), "LeagueFactory: strategyId");
        if (enabled) {
            require(adapter != address(0), "LeagueFactory: adapter");
        }
        _strategies[strategyId] = StrategyInfo({adapter: adapter, enabled: enabled});
        emit StrategyRegistryUpdated(strategyId, adapter, enabled);
    }
}
