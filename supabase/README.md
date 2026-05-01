# Supabase migrations

This directory holds the SQL schema for the Advantage Journal portal and a demo seed file. The schema mirrors the in-memory store so the application's adapter layer (`lib/api/supabase-adapter.ts`) can swap in transparently.

## Files

- `migrations/0001_init.sql` — initial schema: enums, tables, indexes, triggers, RLS policies (MVP-grade).
- `seed.sql` — optional demo data for poking around before real users exist.

## Apply locally with the Supabase CLI

```bash
# one-time
npm i -D supabase
npx supabase login
npx supabase init                    # creates ./supabase/config.toml if missing
npx supabase link --project-ref <your-ref>

# apply the migration to the linked project
npx supabase db push

# load the demo seed (optional)
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

If you prefer the SQL editor in the dashboard, paste `migrations/0001_init.sql` and run it; then optionally paste `seed.sql`.

## Running the app against Supabase

Set `NEXT_PUBLIC_DATA_MODE=supabase` plus the Supabase env vars (see `.env.example`). With those set, the app's `ApiClientProvider` activates the Supabase adapter. With them unset (or `NEXT_PUBLIC_DATA_MODE=mock`), the in-memory mock store is used — no Supabase round-trip occurs.

If `NEXT_PUBLIC_DATA_MODE=supabase` but the env vars are missing or invalid, the provider logs a console warning and falls back to mock so the dev server stays usable.

## RLS posture

The MVP policies in `0001_init.sql` are intentionally narrow on reads (per-role scoping) and broad on writes (any authenticated user can write rows their role permits). The application-layer permission helpers in `lib/permissions.ts` are the second line of defense. Tighten the write policies in a follow-up migration once the production permission matrix is locked in.

The moderation reports table has the strictest read policy: only `leader` or `admin` roles can read. Inserts are allowed for any reporter. Status changes (`open` → `in_review` → `resolved` / `dismissed`) are restricted to leaders/admins.

## Adding a new migration

Follow zero-padded numeric prefixes:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_<descriptive_slug>.sql
```

Never rewrite a previously-applied migration; add a new one that performs the change.
