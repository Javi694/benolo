// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../lib/IERC20.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";
import {ReentrancyGuard} from "../lib/ReentrancyGuard.sol";
import {Initializable} from "../lib/Initializable.sol";
import {ILeagueVault} from "../interfaces/ILeagueVault.sol";
import {ILeagueFactory} from "../interfaces/ILeagueFactory.sol";
import {IStrategyAdapter} from "../interfaces/IStrategyAdapter.sol";

contract LeagueVault is ILeagueVault, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 private constant BPS_DENOMINATOR = 10_000;

    struct PlayerInfo {
        uint256 deposited;
        uint256 withdrawnPrincipal;
        uint256 withdrawnYield;
        uint16 shareBps;
    }

    address public factory;
    IERC20 public asset;
    address public strategyAdapter;
    address public creator;
    bytes32 public leagueId;
    bytes32 public strategyId;
    uint256 public entryAmount;
    uint16 public exitPenaltyBps;
    uint16 public commissionBps;
    bool public canEarlyExit;

    Status private _status;
    uint256 private _totalPrincipal;
    uint256 private _penaltyReserve;
    uint256 private _totalYield;
    uint256 private _yieldPool;
    uint256 private _commissionAccrued;
    uint256 private _commissionClaimed;
    uint256 private _investedPrincipal;
    uint256 private _strategyShares;

    mapping(address => PlayerInfo) private _players;
    address[] private _winnerAccounts;

    modifier onlyFactory() {
        require(msg.sender == factory, "LeagueVault: not factory");
        _;
    }

    modifier onlyCreatorOrFactory() {
        require(msg.sender == creator || msg.sender == factory, "LeagueVault: not authorised");
        _;
    }

    function initialize(VaultConfig calldata config) external override initializer {
        _guardInitialize();

        require(config.leagueId != bytes32(0), "LeagueVault: leagueId");
        require(config.asset != address(0), "LeagueVault: asset");
        require(config.creator != address(0), "LeagueVault: creator");
        require(config.exitPenaltyBps <= BPS_DENOMINATOR, "LeagueVault: penalty");
        require(config.commissionBps <= BPS_DENOMINATOR, "LeagueVault: commission");

        factory = msg.sender;
        creator = config.creator;
        asset = IERC20(config.asset);
        leagueId = config.leagueId;
        strategyId = config.strategyId;
        entryAmount = config.entryAmount;
        exitPenaltyBps = config.exitPenaltyBps;
        commissionBps = config.commissionBps;
        canEarlyExit = config.canEarlyExit;

        (address adapter, bool enabled) = ILeagueFactory(msg.sender).getStrategyAdapter(config.strategyId);
        require(enabled && adapter != address(0), "LeagueVault: strategy");
        strategyAdapter = adapter;

        _status = Status.FUNDING;
    }

    function deposit(uint256 amount) external override nonReentrant {
        require(_status == Status.FUNDING, "LeagueVault: not funding");
        if (entryAmount > 0) {
            require(amount == entryAmount, "LeagueVault: amount");
        }
        require(amount > 0, "LeagueVault: zero");

        asset.safeTransferFrom(msg.sender, address(this), amount);

        PlayerInfo storage p = _players[msg.sender];
        p.deposited += amount;

        _totalPrincipal += amount;

        emit Deposited(msg.sender, amount);
    }

    function earlyExit(uint256 amount) external override nonReentrant {
        require(canEarlyExit, "LeagueVault: exit off");
        require(_status == Status.FUNDING, "LeagueVault: not funding");
        require(amount > 0, "LeagueVault: zero");

        PlayerInfo storage p = _players[msg.sender];
        require(p.deposited >= amount, "LeagueVault: insufficient");

        uint256 penalty = (amount * exitPenaltyBps) / BPS_DENOMINATOR;
        uint256 refund = amount - penalty;

        p.deposited -= amount;
        _totalPrincipal -= amount;
        _penaltyReserve += penalty;

        asset.safeTransfer(msg.sender, refund);

        emit EarlyExit(msg.sender, refund, penalty);
    }

    function lock() external override onlyCreatorOrFactory nonReentrant {
        require(_status == Status.FUNDING, "LeagueVault: state");

        uint256 principal = _totalPrincipal;
        require(principal > 0, "LeagueVault: no principal");

        _status = Status.LOCKED;

        asset.safeApprove(strategyAdapter, 0);
        asset.safeApprove(strategyAdapter, principal);

        uint256 shares = IStrategyAdapter(strategyAdapter).deposit(principal);
        require(shares > 0, "LeagueVault: no shares");

        _investedPrincipal = principal;
        _strategyShares = shares;
        _totalPrincipal = principal;

        _status = Status.INVESTED;

        emit Locked(principal);
    }

    function harvest() external override onlyFactory {
        require(_status == Status.INVESTED, "LeagueVault: not invested");

        uint256 totalAssets = IStrategyAdapter(strategyAdapter).unrealisedBalance();
        require(totalAssets >= _investedPrincipal, "LeagueVault: loss");

        uint256 newYield = totalAssets - _investedPrincipal;
        require(newYield > _totalYield, "LeagueVault: no yield");

        uint256 harvested = newYield - _totalYield;
        _totalYield = newYield;

        emit Harvested(harvested);
    }

    function settle(bytes calldata /*settleData*/ ) external override onlyFactory nonReentrant {
        require(_status == Status.INVESTED || _status == Status.LOCKED, "LeagueVault: not active");

        _status = Status.SETTLING;

        if (_strategyShares > 0) {
            IStrategyAdapter(strategyAdapter).withdrawAll(address(this));
            _strategyShares = 0;
        }

        _investedPrincipal = 0;

        uint256 available = asset.balanceOf(address(this));
        uint256 principal = _totalPrincipal;
        uint256 distributable;

        if (available > principal) {
            distributable = available - principal;
        }

        if (_penaltyReserve > 0) {
            _penaltyReserve = 0;
        }

        uint256 commission;
        uint256 winnersYield;
        if (distributable > 0) {
            commission = (distributable * commissionBps) / BPS_DENOMINATOR;
            winnersYield = distributable - commission;
            _commissionAccrued += commission;
        }

        _yieldPool = winnersYield;
        _totalYield = distributable;

        emit Settled(principal, winnersYield, commission);
    }

    function setWinners(WinnerShare[] calldata shares) external override onlyFactory {
        require(_status == Status.SETTLING, "LeagueVault: state");

        uint256 len = _winnerAccounts.length;
        for (uint256 i = 0; i < len; i++) {
            _players[_winnerAccounts[i]].shareBps = 0;
        }
        delete _winnerAccounts;

        uint256 totalBps;
        len = shares.length;
        for (uint256 i = 0; i < len; i++) {
            WinnerShare calldata share = shares[i];
            require(share.account != address(0), "LeagueVault: zero");
            require(share.shareBps > 0, "LeagueVault: zero bps");

            PlayerInfo storage p = _players[share.account];
            require(p.deposited > 0, "LeagueVault: not player");

            p.shareBps = share.shareBps;
            _winnerAccounts.push(share.account);
            totalBps += share.shareBps;
        }

        require(totalBps == BPS_DENOMINATOR, "LeagueVault: sum");

        emit WinnersSet(msg.sender, shares.length);
    }

    function openClaims() external override onlyFactory {
        require(_status == Status.SETTLING, "LeagueVault: state");
        _status = Status.DISTRIBUTED;
        emit ClaimsOpened();
    }

    function claim() external override nonReentrant {
        require(_status == Status.DISTRIBUTED, "LeagueVault: state");

        PlayerInfo storage p = _players[msg.sender];
        require(p.deposited > 0, "LeagueVault: no deposit");

        (uint256 principalOwed, uint256 yieldOwed, uint256 grossYield) = _claimable(p);

        if (grossYield > p.withdrawnYield) {
            p.withdrawnYield = grossYield;
        }

        require(principalOwed > 0 || yieldOwed > 0, "LeagueVault: nothing");

        if (principalOwed > 0) {
            p.withdrawnPrincipal += principalOwed;
        }

        asset.safeTransfer(msg.sender, principalOwed + yieldOwed);

        emit Claimed(msg.sender, principalOwed, yieldOwed);
    }

    function claimCommission(address to) external override onlyFactory nonReentrant {
        require(to != address(0), "LeagueVault: zero");
        uint256 due = _commissionAccrued - _commissionClaimed;
        require(due > 0, "LeagueVault: no commission");
        _commissionClaimed += due;
        asset.safeTransfer(to, due);
        emit CommissionClaimed(to, due);
    }

    function activateEmergency() external override onlyFactory {
        require(_status != Status.EMERGENCY, "LeagueVault: already");
        _status = Status.EMERGENCY;

        if (_strategyShares > 0) {
            IStrategyAdapter(strategyAdapter).withdrawAll(address(this));
            _strategyShares = 0;
        }

        emit EmergencyActivated();
    }

    function resolveEmergency() external override onlyFactory {
        require(_status == Status.EMERGENCY, "LeagueVault: state");
        _status = Status.SETTLING;
        emit EmergencyResolved();
    }

    function status() external view override returns (Status) {
        return _status;
    }

    function totalDeposited() external view override returns (uint256) {
        return _totalPrincipal;
    }

    function totalYield() external view override returns (uint256) {
        return _totalYield;
    }

    function commissionDue() external view override returns (uint256) {
        return _commissionAccrued - _commissionClaimed;
    }

    function claimable(address account) external view override returns (uint256 principalOwed, uint256 yieldOwed) {
        if (_status != Status.DISTRIBUTED) {
            return (0, 0);
        }

        PlayerInfo storage p = _players[account];
        if (p.deposited == 0) {
            return (0, 0);
        }

        (principalOwed, yieldOwed,) = _claimableView(p);
    }

    function _claimable(PlayerInfo storage p)
        internal
        view
        returns (uint256 principalOwed, uint256 yieldOwed, uint256 grossYield)
    {
        (principalOwed, yieldOwed, grossYield) = _claimableView(p);
    }

    function _claimableView(PlayerInfo storage p)
        internal
        view
        returns (uint256 principalOwed, uint256 yieldOwed, uint256 grossYield)
    {
        principalOwed = p.deposited - p.withdrawnPrincipal;

        if (p.shareBps > 0) {
            grossYield = (_yieldPool * p.shareBps) / BPS_DENOMINATOR;
            if (grossYield > p.withdrawnYield) {
                yieldOwed = grossYield - p.withdrawnYield;
            }
        }
    }
}
