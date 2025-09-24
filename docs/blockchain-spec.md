# Benolo Yield League – Blockchain Functional Spec (Sept 2025)

## 1. Scope & Guiding Principles
- **Asset**: USDC on Base mainnet for the beta. Future-compatible with Arbitrum / Optimism / Linea (same contract code, different addresses).
- **Custody model**: non-custodial. Funds sit in a dedicated league vault smart contract that invests in a DeFi strategy while locked.
- **League metadata source**: Supabase remains the system of record for leagues, participants, scoring, and completion triggers. On-chain state should mirror only the finance data (deposits, yield, penalties, distribution).
- **Configurator ownership**: each league is parameterised at creation (strategy, exit penalty, reward distribution, commission tier). Parameters are immutable once the contract is initialised.
- **Security posture**: start with a minimal, audited set of strategies (Safe / Balanced / Yield+) and a circuit-breaker for emergency withdrawal.

## 2. Architecture Overview

```
Creator (front)  ── RainbowKit/Wagmi ──> LeagueFactory ─ deploys ─> LeagueVault (per league)
                                    │                         │
                                    └─ Supabase RPC (store) ──┘

LeagueVault ── invests via StrategyAdapter ──> DeFi protocol (Base)
```

- **LeagueFactory** (singleton): deploys new `LeagueVault` instances using minimal proxy (EIP-1167). Validates parameters and records them on chain.
- **LeagueVault** (per league): holds USDC deposits, tracks player balances, applies exit penalties, forwards principal to `StrategyAdapter` when locked, harvests yield, and settles payouts at league completion.
- **StrategyAdapter** (per strategy id): encapsulates the integration with external protocols (Aave, Morpho, Pendle…). Keeps a whitelist controlled by Benolo so leagues can only choose approved strategies.
- **Supabase orchestration**: when a league is created in the wizard, Supabase calls the factory (via backend or client wallet) to deploy the vault and stores the returned address + parameters. Upon league completion (triggered by match sync / scoring), Supabase sends a transaction to `settle()` the vault.

## 3. League Lifecycle & States

| State            | On-chain status enum | Description                                                   | Trigger                                      |
|------------------|----------------------|---------------------------------------------------------------|----------------------------------------------|
| `Created`        | `CREATED`            | Vault deployed, accepting deposits.                          | Factory deployment                           |
| `Funding`        | `FUNDING`            | Participants deposit USDC, can exit with penalty if allowed. | Default state after deployment               |
| `Locked`         | `LOCKED`             | Deposits closed, funds invested into chosen strategy.        | `lock()` called when Supabase marks league start |
| `Invested`       | `INVESTED`           | Strategy adapter holds assets accruing yield.                | Auto after successful invest                 |
| `Settling`       | `SETTLING`           | League complete, yield harvested, commissions deducted.      | `settle()` called by automation/admin        |
| `Distributed`    | `DISTRIBUTED`        | Winners recorded, balances claimable.                        | `setWinners()` + `openClaims()`              |
| `Emergency`      | `EMERGENCY`          | Manual break-glass (admin) – stops strategy, allows refunds. | `activateEmergency()`                        |

## 4. Storage Layout (per LeagueVault)
- `leagueId` (bytes32 / uuid) – Supabase league reference.
- `creator` (address).
- `asset` (address) – USDC.
- `strategyId` (bytes32) – maps to adapter implementation.
- `entryAmount` (uint256) – deposit requirement per player (optional: zero for free).
- `exitPenaltyBps` (uint16) – 0–10,000 basis points set by creator.
- `commissionBps` (uint16) – Benolo revenue share on NET yield.
- `distribution` struct – chosen payout scheme (`winnerOnly`, `top3`, `custom`, etc.).
- `status` (enum).
- `totalDeposited` (uint256).
- `totalYield` (uint256) – accumulated yield (after harvesting).
- `pendingPrincipal` (uint256) – amount currently invested.
- `players` mapping (address ⇒ PlayerInfo).
- `PlayerInfo`: `deposited`, `withdrawnPrincipal`, `withdrawnYield`, `eligibleShareBps`.
- `winners` array – final leaderboard addresses with share basis points (populated post scoring).

## 5. Key Functions

### Factory
- `createLeague(CreateParams params)`
  - Validates `exitPenaltyBps ≤ 10000`, `strategyId` in whitelist, `commissionBps ≤ 2000` (example cap 20%).
  - Deploys `LeagueVault` via clone, calls `initialize()`.
  - Emits `LeagueCreated(leagueId, vaultAddress, params)`.

### LeagueVault (participant flows)
- `deposit()`
  - Requires status `FUNDING`.
  - Transfers `entryAmount` USDC from player.
  - Mints internal balance (`PlayerInfo.deposited`).
  - Emits `Deposit(player, amount)`.

- `earlyExit(uint256 amount)`
  - Allowed only during `FUNDING` if creator enabled exit.
  - Penalty = `amount * exitPenaltyBps / 10000`.
  - Penalty portion credited to `penaltyReserve` (added to final yield pool).
  - Remaining returned to player.
  - Emits `EarlyExit(player, amount, penalty)`.

- `lock()` (callable by creator or Benolo operator)
  - Switches status to `LOCKED`, blocks further deposits.
  - Approves adapter to pull USDC, calls `StrategyAdapter.deposit(totalPrincipal)`.

- `harvest()`
  - Callable periodically to pull accrued yield back into vault (`totalYield += harvested`).

- `settle(SettleParams params)`
  - Triggered when Supabase marks league completed.
  - Calls `StrategyAdapter.withdrawAll()` to regain principal + yield.
  - Computes Net Yield = `max(totalAssets - totalPrincipal, 0)` + penalties reserve.
  - Deducts Benolo commission: `commission = netYield * commissionBps / 10000`.
  - Sets `yieldPool = netYield - commission`.
  - Emits `Settled(principal, yieldPool, commission)`.

- `setWinners(WinnerShare[] shares)`
  - Called by Benolo operator using the final leaderboard from Supabase.
  - Validates sum of share basis points = 10,000.
  - Updates `winners` and players’ `eligibleShareBps`.

- `openClaims()`
  - Switches status to `DISTRIBUTED`.

- `claim()`
  - Allows each player to withdraw: `principal` (their deposit) + `yieldPool * eligibleShareBps / 10000` (if any).
  - Marks balances as withdrawn to prevent double spend.

- `claimCommission(address to)`
  - Benolo Treasury withdraws accumulated commission.

- `activateEmergency()` / `resolveEmergency()`
  - Admin controls to halt deposits, withdraw from strategy instantly, allow principal-only refunds.

## 6. Distribution Schemes
- `winnerOnly`: 10,000 bps to rank 1.
- `topThree`: [6000, 2500, 1500].
- `topFive`: [4000, 2500, 2000, 1000, 500].
- `topTenPercent`: computed at runtime from leaderboard (requires Supabase feeding share list).
- `customSplit`: array provided by creator during setup (validated sum = 10,000).

Supabase stores the chosen option and, at settlement, sends the corresponding `WinnerShare[]` to `setWinners()`.

## 7. Commission Model Proposal
- **Baseline**: 10% of net yield (commissionBps = 1000). Applied only if `netYield > 0`.
- **Yield-tiered uplift** (optional future): if net yield per player exceeds fixed thresholds, commission scales:
  - < 5% APR (annualised): 10%
  - 5–10% APR: 12.5%
  - > 10% APR or risky strategy: 15%
- Percentages stored per league (within an allowed range) to let Benolo adjust per strategy.

## 8. Strategy Catalog – Base Mainnet

| Tier      | Adapter ID        | Protocol       | APY (as of Sept 2025) | Risk Notes                                                |
|-----------|-------------------|----------------|-----------------------|-----------------------------------------------------------|
| Safe      | `AAVE_USDC_V3`    | Aave v3 Base   | ~5.2% variable        | Battle-tested, low smart contract risk, optional e-mode.  |
| Balanced  | `MORPHO_BLUE_USDC`| Morpho Blue    | ~7.5% target APY      | Matches Aave liquidity but isolation risk; oracle reliance|
| Yield+    | `PENDLE_GLP_PTL`  | Pendle (USDC/PT)| ~11–14%               | Higher smart contract & market risk, requires active mgmt.|

> Future expansion: add Compound v3, Gearbox leveraged vaults, or curated vault providers (Yearn, Beefy). Each new adapter must pass security review and be whitelisted by Benolo governance.

## 9. Supabase ↔ On-chain Sync
- `leagues` table gains fields: `vault_address`, `strategy_id`, `exit_penalty_percent`, `commission_bps`.
- When a league is created:
  1. Frontend collects parameters.
  2. Client signs `createLeague` tx via RainbowKit.
  3. On success, edge function writes vault address + params into Supabase.
- When `evaluate_league_start` flips league to active → backend calls `lock()`.
- When `evaluate_league_completion` marks completed → backend sequences `settle()`, `setWinners()`, `openClaims()`.
- Player dashboard consumes both Supabase (leaderboard) and on-chain (claimable balances) via Wagmi hooks.

## 10. Security & Ops Checklist
- Use `DefaultReserveInterestRateStrategy` values from Aave for APR monitoring; pause league if APY spikes abnormally.
- Add contract upgrade path via proxy or versioned factory (upgradable strategy adapters rather than vault core to keep funds safe).
- Implement pausable pattern and guardian multisig for emergency features.
- Run audit on LeagueVault + StrategyAdapter set before mainnet deployment.

## 11. Next Steps
1. Review & confirm parameters (commission range, strategy IDs, balanced/yield+ protocol choices).
2. Update Supabase schema & wizard UI with new fields (exit penalty %, strategy select, commission display).
3. Draft Solidity interfaces (`ILeagueVault`, `IStrategyAdapter`, `ILeagueFactory`).
4. Plan RainbowKit flow: wallet connection, network enforcement (Base), signing `createLeague`, showing claim balances.
5. Prepare test plan: local fork of Base, impersonate Aave pool, simulate full league lifecycle, verify penalties & commission.

