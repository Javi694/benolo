# Benolo Prototype – Next.js Implementation

This project converts the original Figma-generated prototype into a real Next.js 14 application. It ships with Tailwind CSS, shadcn UI primitives, and a demo flow that mimics the Benolo betting experience while using local mock data.

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment variables

   Copie `.env.example` vers `.env.local`. Si tu utilises Supabase local :

   ```bash
   source supabase/.env
   ```

   Sinon, renseigne les valeurs cloud :

   ```ini
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
   ```

3. Lancer Supabase (local)

   ```bash
   npm exec supabase start
   ```

4. Démarrer Next.js

   ```bash
   npm run dev
   ```

5. Tests / lint

   ```bash
   npm run lint
   npm test
   ```

## Project structure

- `src/app/` – Next.js App Router entry (`page.tsx`) and global styles.
- `src/components/` – UI building blocks and feature screens derived from the prototype.
- `src/data/content.ts` – Centralized mock data, translations, and lookup helpers.
- `src/types/` – Shared TypeScript helpers (`app.ts`).
- `src/app/profile/page.tsx` – User profile (edit info + link an EVM wallet through RainbowKit/Wagmi).
- `src/app/admin/page.tsx` – Admin dashboard (list users, change roles – the first registered user is promoted automatically).
- `supabase/migrations/` – Database schema: profiles, leagues, league members, wallets, etc.
- `server/` – Legacy API prototype from the Figma export (excluded from the Next.js build). Keep for reference or remove when wiring a real backend.

## Notes & next steps

- The UI uses static mock data. Replace the datasets in `src/data/content.ts` with live API calls as soon as the backend is ready.
- Authentication remains a demo flow. The `LoginForm` component only works when Supabase credentials are provided.
- Tailwind classes have been aligned with the new design tokens. Adjust the theme in `src/app/globals.css` and `tailwind.config.ts` as needed.
- Ensure Supabase keys and any future secrets live in environment variables, not in the repo.


## Supabase local setup

1. Assure-toi d'avoir Docker et le Supabase CLI (`npm run supabase -- --version` si installé localement).
2. Initialise l'environnement la première fois avec `npx supabase init` (déjà fait dans ce repo).
3. Démarre l'instance locale :
   ```bash
   npx supabase start
   ```
   Le CLI te donnera les variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`; copie-les dans `.env.local` pour tester l'auth.
4. Applique le schéma :
   ```bash
   npx supabase db reset
   ```
   Cela exécute les migrations contenues dans `supabase/migrations/*.sql`.
5. Quand tu as fini :
   ```bash
   npx supabase stop
   ```


6. Renseigne les clés OAuth dans `supabase/auth.env`, puis charge-les dans ton shell avant de démarrer Supabase :
   ```bash
   source supabase/auth.env
   npx supabase stop && npx supabase start
   ```
   (tu peux aussi exporter les variables manuellement).
Les tables créées :
- `profiles` : infos publiques (pseudo, avatar, langue…).
- `user_connections` : trace des providers OAuth (Google, Apple, etc.).
- `user_wallets` : wallets liés à l'utilisateur, avec trigger pour un seul wallet primaire.
- `leagues` : ligues créées (code d'invitation, statut, créateur, paramètres).
- `league_members` : membres des ligues et leurs rôles (owner/admin/member).

Les politiques RLS limitent l'accès à l'utilisateur courant; le rôle `service_role` peut tout gérer pour les Edge Functions.

## Sports data ingestion

- Edge function `sync-matches` keeps `league_matches` in sync with the external provider and automatically closes leagues via the new completion triggers.
- Required env vars for deployment: `SUPABASE_SERVICE_ROLE_KEY`, `SPORTS_DATA_API_KEY`, optional `SPORTS_DATA_API_URL`, `SPORTS_DATA_LOOKBACK_DAYS`, `SPORTS_DATA_LOOKAHEAD_DAYS`, `SYNC_MATCHES_SECRET`.
- Map your championships to provider leagues in `supabase/functions/_shared/provider-config.ts` (API-Football IDs prefilled for major soccer leagues; NBA/NFL default to mock data).
- Local run example: `SYNC_MATCHES_SECRET=devsecret npx supabase functions serve sync-matches` then `curl -X POST -H "Authorization: Bearer devsecret" -d '{"leagueId":"<uuid>"}' http://localhost:54321/functions/v1/sync-matches`.
- Deploy once ready: `npx supabase functions deploy sync-matches --project-ref <project>` and attach to Supabase Cron for hourly execution.
