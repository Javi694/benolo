# Benolo League Contracts

## Current Layout
- `src/LeagueFactory.sol` – deploys minimal-proxy vaults, validates parameters, and keeps the approved strategy registry.
- `src/LeagueVault.sol` – non-custodial league vault handling deposits, optional early exits, strategy investment, settlement, claims, commissions, and emergency unwind.
- `src/adapters/` – placeholder strategy adapters for Base (`AaveV3Adapter`, `MorphoBlueAdapter`, `PendlePTAdapter`) built on a reusable `AbstractHoldingAdapter` skeleton.
- `interfaces/` – typed ABIs consumed by the frontend/backoffice orchestration.
- `lib/` – lightweight dependencies (clones, ERC20 helpers, initialiser, reentrancy guard, ownable).
- `test/` – Foundry contract tests (`LeagueLifecycle.t.sol`) and supporting mocks.

Factory and vault mirror the behaviour documented in `docs/blockchain-spec.md`:
- Vaults start in `FUNDING`, accept deposits (enforcing `entryAmount` when set) and optional early exits with creator-defined penalties.
- `lock()` shifts funds into the chosen adapter; only the league creator or Benolo operator (factory) can trigger it.
- Yield accounting follows the adapter balance, with settlement computing Benolo commission and yield pool for winners.
- `setWinners` + `openClaims` gates the claim window, letting players withdraw principal plus yield share while the factory withdraws commission separately.
- Emergency mode withdraws strategy exposure immediately and freezes the league until resolved.

## Local Development
1. Install Foundry (or Hardhat) if not already available; Foundry is recommended for cloning and testing (`curl -L https://foundry.paradigm.xyz | bash`).
2. Run `forge init`-style commands from `contracts/` only if you need additional tooling; current sources are plain Solidity and do not depend on remappings.
3. To compile or test with Foundry:
   ```bash
   cd contracts
   forge build
   forge test
   ```
   (The repo already vendors `forge-std`; install Foundry once via `foundryup` if needed.)
4. When wiring adapters, extend `StrategyRegistry` through `LeagueFactory.setStrategyAdapter` and deploy adapter contracts separately.

## Foundry Test Coverage
- `LeagueLifecycle.t.sol` exercises the happy-path lifecycle: factory clone → deposits → lock/invest → yield settlement → claims and commission withdrawal.
- Extend with edge scenarios (early exits, emergency activation, zero-yield leagues, re-entrancy fuzzing) once protocol adapters are wired.

## Deployment & Next Tasks
- Swap placeholder adapters for live protocol integrations (Aave supply/withdraw, Morpho markets, Pendle PT redemptions) and bound risk/SLAs per spec.
- Expose factory helper methods (or a coordinator contract) if Benolo automation should trigger `lock`/`settle`/`openClaims` without impersonating the factory address.
- Produce deployment scripts (`forge script` or Hardhat) that deploy the factory + implementation, instantiate adapters with Base endpoints, register strategy IDs, and write addresses back into Supabase.
- Harden adapters to accept deposits only from authorised vaults (post-deployment allow-list) and add guardian/pausable controls before mainnet.
- Schedule a security review covering vault maths, adapter integrations, and multi-chain assumptions.

### Aave v3 Adapter (Base) – Runbook
1. **Paramètres à réunir**
   - `POOL` : adresse du contrat `IPool` Aave v3 sur Base.
   - `aToken` : adresse du jeton `aUSDC` renvoyé par `getReserveData`.
   - `USDC` : adresse du token sous-jacent (doit correspondre à `NEXT_PUBLIC_USDC_ADDRESS`).
2. **Déploiement**
   ```bash
   cd contracts
   forge script scripts/DeployAaveAdapter.s.sol \
     --rpc-url $BASE_RPC_URL \
     --broadcast --verify
   ```
   (Le script devra transmettre `POOL`, `aToken`, `USDC`, `strategyId = keccak256("AAVE_USDC_V3")`, `owner` = multisig Benolo.)
3. **Enregistrement côté factory**
   ```solidity
   leagueFactory.setStrategyAdapter(keccak256("AAVE_USDC_V3"), aaveAdapterAddress, true);
   ```
4. **Autorisation des vaults**
   - Après chaque `createLeague`, appeler `AaveV3Adapter.setAllowedVault(vault, true)` (via backoffice ou automation Supabase/Edge).
5. **Configuration front**
   - Renseigner `NEXT_PUBLIC_LEAGUE_FACTORY_ADDRESS` et `NEXT_PUBLIC_USDC_ADDRESS` avec les valeurs déployées.
6. **Contrôles post-déploiement**
- Vérifier sur Base Sepolia un cycle `deposit → lock → settle` pour confirmer les retraits.
- Surveiller `totalAssets()` : il doit refléter `aUSDC.balanceOf(adapter)` + éventuel cash local.

### Morpho Blue Adapter – Paramétrage
- `MarketParams` doit correspondre exactement au marché isolé choisi (USDC prêté). Renseigner `loanToken` (USDC), `collateralToken`, `oracle`, `irm`, `lltv`.
- Déployer l’adapter en passant `owner_ = leagueFactoryOwner` pour que l’allowlist automatique fonctionne.
- S’assurer que l’oracle et le marché sont actifs sur Base (utiliser Morpho Blue configurator). Mise à jour possible via redeploy.

### Pendle PT Adapter – Paramétrage
- `yieldVault` doit être un wrapper ERC-4626 (ex: PT via concentrator). Vérifier que `vault.asset()` retourne bien l’adresse USDC.
- Prévoir une surveillance du ratio `convertToAssets` pour anticiper les pertes/performance.
- Deployer avec `owner_ = leagueFactoryOwner` pour l’allowlist.
