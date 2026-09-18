# Supabase migration — 2026-09-18

Target project: `zzronpsjosajfxutnfzp`.

## Current state

Firebase remains the production backend until the migration branch is deployed. Supabase now contains 10 Auth accounts and all 57 source documents: 8 organizations, 15 historical profiles, 5 supplies, 7 vendors, 4 locations, 9 pending signups, 2 historical password tokens and 7 audit records. One additional profile retains an Auth account that had no Firestore profile. Six historical profiles have no login account and remain unlinked.

The original Firebase export is in the ignored `.migration-backups` directory. Original documents are also retained in `migration_private.source_documents`, inaccessible to browser roles. Incomplete historical password tokens are expired. Historical signup password fields are excluded from public tables. Never commit or share the export.

## Deployment setup

Set these Vercel environment variables for the deployment target, using the values already stored in local `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only)
- `SUPABASE_DB_URL` (server-only Session pooler connection string)

Keep Stripe, Resend, Turnstile and CRON_SECRET configured. They continue providing payments, mail delivery, abuse prevention and scheduled reminder authentication. Vercel continues hosting Next.js and the daily cron route. Supabase replaces Firebase Auth, Firestore and live data subscriptions. There is no application file-upload storage to migrate.

In Supabase Authentication → URL Configuration, set Site URL to `https://www.getrestok.com` and allow these redirect URLs:

- `https://www.getrestok.com/**`
- `https://getrestok.com/**`
- `http://localhost:3000/**`
- `http://127.0.0.1:3000/**`

Enable Google under Authentication → Sign In / Providers using the Google OAuth web client ID and secret. Add `https://zzronpsjosajfxutnfzp.supabase.co/auth/v1/callback` to that client's authorized redirect URIs in Google Cloud. Verified Google identities can link to the imported account with the same verified email; check the existing Google account before cutover.

## Passwords and recovery

Firebase password hashes are not imported. Imported password accounts have random unknown passwords and must use **Forgot your password?** once. The recovery endpoint generates Supabase one-time recovery tokens and sends links through existing Resend configuration. It requires Turnstile and enforces a five-minute account cooldown. Migration does not send any mail. Existing invitation/setup links continue using the server-only token table.

## Validation and cutover

- `node --env-file=.env.local scripts/supabase-migrate.cjs verify .migration-backups/<export>/firebase.json`
- `node --env-file=.env.local scripts/verify-supabase.cjs` creates and removes disposable test fixtures; no emails are sent.
- `node --test tests/restock.test.cjs`
- `node node_modules/eslint/bin/eslint.js .`
- `node node_modules/next/dist/bin/next build`

Before production cutover, test login, Google login, workspace loading, supply edits, ordering/receiving, preferences, invitations, billing and internal administration. If Firebase data changed after the export, take a new export and review/reconcile it before cutting over. Import is intended for the pre-cutover target; do not rerun it over an active Supabase app because source data would overwrite newer changes.

Keep Firebase and the pre-migration release (`81a86c9`) available for rollback. A rollback after new Supabase writes requires reconciliation; reverting code alone would hide those writes. Do not delete Firebase or rotate away its export credentials until migration acceptance. Any separately deployed old Firebase reminder functions must be disabled at cutover to avoid duplicate reminders.

## Database access

Public tables use row-level security. Browser clients can access only their active organization. Profile membership, roles and administrator flags are changed through authenticated server endpoints. The server uses a PostgreSQL pool for transactional operations. Legacy IDs are preserved, with a separate UUID link to Supabase Auth; unknown legacy fields are retained in metadata. Core supply/vendor/location relationships are enforced by foreign keys.

## Verified on September 18

Production and Preview Vercel variables are configured; server values use Secret storage. Google provider is enabled and production/local redirect URLs are saved. The full field comparison passed against the fresh 15:52 UTC Firebase export. Native Auth/RLS checks and local API checks passed, including alternate notification email persistence and concurrent receive deduplication. No verification emails were sent. Nine regression tests, ESLint and the production build pass. Browser login and password-recovery screens load.
