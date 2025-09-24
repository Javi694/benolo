# Benolo Dev Context (Sept 2025)

## Résumé rapide
- Front Next.js branché sur Supabase : dashboard, ligue, paris, wizard refactorisé, scoring 6/3/0.
- Schéma Supabase étendu (start_condition, triggers auto, RLS serrée, cron pg_cron).
- Données encore mock/manuel, pas d’intégration API sports, pas de smart contract opérationnel.
- Edge function `sync-matches` (API Football) + triggers de clôture auto : ingest fixtures, met à jour scores/statuts et clôture la ligue quand tout est terminé.

## Flux actuel
1. Création ligue : choisit public/privé, payant/gratuit, championnat, déclencheur (date → deadline & démarrage, ou seuil joueurs). Wizards et validations alignés.
2. Démarrage : triggers `evaluate_league_start` + cron `league_start_eval` basculent la ligue en `active` (status + started_at) quand date passée ou seuil atteint.
3. Pronostics : front bloque si ligue/match pas démarrés, RLS Supabase empêche insert/update sans statut OK.
4. Scoring : score exact 6 pts, bon résultat 3 pts ; triggers recalculent points + vue `league_leaderboard` agrège.

## Dev backlog (bêta fermée)
### 1. Blockchain/Finance
- Choisir stratégie DeFi, finaliser spec smart contracts / API wallet.
- Intégrer RainbowKit/Wagmi (branche payante) et signer les transactions pour dépôt/retrait intérê t.
- Gérer payout des intérêts (automation + UX).

### 2. Data & backend
- Edge function `sync-matches` + triggers de completion livrés (API Football). À étendre aux autres sports/providers & monitorer les quotas.
- Fignoler la transition des statuts pour NBA/NFL (provider manquant) + fallback en cas d’échec API.
- Si besoin, service backend orchestrant Supabase + blockchain + provider.

### 3. Front/UX compléments
- Landing/onboarding beta (copie, FAQ, flow d’invitation).
- Admin panel pour monitoring, forcer transitions.
- Tests e2e (wizard, blocage paris, validations) + Sentry/logging.

### 4. Infra/Prod
- Déployer Supabase géré, appliquer migrations/RLS/cron.
- Déployer Next.js (Vercel etc.), gérer secrets env.
- Mettre en place monitoring (logs, alertes) et plan de seed/données démo.

### 5. Pilotage bêta
- Plan QA, dataset matches + scénarios de test.
- Slack/Discord feedback, support bêta.
- Dashboard interne (ligues actives, joueurs).

## Tests/Migrations actuelles
- `npm run lint`, `npm test` (Vitest), `tests/leagueStart.test.ts` pour hasLeagueStarted.
- `supabase/migrations/*` incluent triggers start + pg_cron (20250226, 20250227).

## Actions post-reset
- Toujours `source supabase/.env` + `npx supabase start`.
- Re-login pour recréer l’utilisateur `auth.users` avant création ligue.
