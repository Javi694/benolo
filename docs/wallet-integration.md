# Wallet Integration Roadmap (RainbowKit / Wagmi)

## Objectifs
- Garantir que la création de ligue payante se fasse sur Base mainnet avec un wallet connecté.
- Synchroniser Supabase (source de vérité métier) avec les adresses de vault déployées on-chain.
- Préparer les hooks wagmi nécessaires pour piloter `createLeague`, puis plus tard `lock` / `settle` / `claim`.

## Implémentation actuelle (sept. 2025)
- **Providers** : `Web3Provider` enveloppe l'application (RainbowKit + Wagmi + React Query) avec la chaîne Base uniquement.
- **Hook contrat** : `useLeagueFactoryCreate` (dans `src/lib/wagmi/hooks`) simule & exécute `createLeague`, attend le receipt et retourne l'adresse du vault cloné.
- **Wizard** : `CreateLeague` (composant client) orchestre désormais un flux Supabase ➝ EVM :
  1. Insertion de la ligue dans Supabase (status `pending`).
  2. Simulation + transaction `createLeague` (hashées via keccak des `leagueId` et `strategyId`).
  3. Mise à jour du champ `vault_address` côté Supabase.
  4. Rollback Supabase si la transaction échoue.
- **Garde-fous** : vérification wallet connecté, réseau Base (chainId 8453), stratégie sélectionnée, pénalités/commissions dans les bornes.

## Variables d'environnement côté front
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | clé WalletConnect utilisée par RainbowKit. |
| `NEXT_PUBLIC_LEAGUE_FACTORY_ADDRESS` | adresse du `LeagueFactory` déployé sur Base. |
| `NEXT_PUBLIC_USDC_ADDRESS` | adresse du token USDC (6 décimales) utilisé par les vaults. |

> Les adresses invalides sont loguées en console au chargement pour faciliter le debug.

## Flux détaillé Supabase ↔ wagmi ↔ contrats
1. **Collecte du formulaire** (Next.js) → validation métier (pénalité, distribution, etc.).
2. **Supabase `insert`** : crée la ligne `leagues` dans l'état `pending` et retourne l'UUID (`id`).
3. **Préparation des paramètres on-chain** :
   - `leagueId` = `keccak256(stringToHex(uuid))` pour obtenir un `bytes32` stable.
   - `strategyId` = `keccak256` de l'identifiant stratégie.
   - `entryAmount` = `parseUnits(entryFee, 6)`.
4. **Simulation wagmi** (`publicClient.simulateContract`) pour obtenir la request + l'adresse du futur vault.
5. **Signature & envoi** (`writeContractAsync`) depuis le wallet du créateur → attente du receipt.
6. **Persistance** : mise à jour du `vault_address` dans Supabase. En cas d'erreur smart contract, la ligne est supprimée pour éviter les ligues orphelines.

## Prochaines étapes produit
1. Ajouter un indicateur d'état (ex. `TxStepper`) dans le wizard pour afficher « signature », « transaction en cours », « confirmé ».
2. Créer les hooks wagmi pour `LeagueVault.lock`, `settle`, `setWinners`, `openClaims`, `claim`, `claimCommission` (dashboard/admin).
3. Mettre en place une Edge Function Supabase pour enregistrer les hashes et gérer les notifications (webhooks / emails).
4. Étendre le dashboard joueur avec lecture on-chain (`useReadContract`) pour les montants réclamables et un bouton `Claim`.
5. Intégrer une vérification de réseau proactive (RainbowKit `useChainModal`) + switch automatique Base.

## Checklist test local (ligue payante)
1. **Variables d'environnement** :
   - `NEXT_PUBLIC_LEAGUE_FACTORY_ADDRESS` = adresse du factory (mock ou déployé sur Base Sepolia).
   - `NEXT_PUBLIC_USDC_ADDRESS` = adresse ERC-20 (mock) avec 6 décimales.
   - Supabase `.env` doit contenir `SUPABASE_SERVICE_ROLE_KEY` pour la fonction `log-transaction`.
2. **Base de données** : appliquer `supabase db push` pour créer la table `league_transactions` et activer les politiques RLS.
3. **Fonction Edge** : `supabase functions serve log-transaction --env-file supabase/.env` (ou `supabase functions deploy log-transaction`).
4. **Contrats** : déployer le `LeagueFactory`, l'implémentation `LeagueVault` et les adaptateurs (Aave/Morpho/Pendle) sur un réseau de test. Renseigner la whitelist des stratégies via `setStrategyAdapter`.
5. **Données tests** : minter des USDC (mock) pour le wallet test, autoriser le vault éventuel s'il n'est pas géré par la factory.
6. **Parcours UI** :
   - Connecter le wallet sur Base (Sepolia ou fork).
   - Créer une ligue payante → vérifier la transaction `createLeague` + `vault_address` dans Supabase.
   - Dans l'admin, exécuter `lock`/`settle`/`setWinners`/`openClaims` et valider que `league_transactions` se renseigne.
   - Sur le Dashboard joueur, utiliser « Réclamer mes fonds » et confirmer la mise à jour du claimable + journalisation Supabase.
