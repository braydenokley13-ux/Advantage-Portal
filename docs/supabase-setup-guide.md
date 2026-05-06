# Supabase Setup Guide

This guide takes a developer from "empty Supabase account" to "Next.js
app authenticating against real Supabase Auth, reading from real
Postgres, and uploading to real Storage". It is paired with
`docs/backend-integration-roadmap.md` (which gives the order of work)
and `docs/frontend-ui-architecture.md` (which gives the integration
points).

> Heads up: do not commit any real keys. Every example below uses
> placeholder values like `your-project-ref` or `pk_live_xxx`.

---

## 1. Create the Supabase project

1. Sign in at <https://supabase.com>.
2. Create a new project. Choose the region closest to your users.
3. Pick a strong database password and store it in your secret manager
   (1Password / Vault / etc.). You will need it for migrations and
   restoring DB connections; the app itself does NOT need this password.
4. Wait for the project to provision (~2 minutes).
5. From **Project Settings → API**, copy:
   - **Project URL** (`https://your-project-ref.supabase.co`)
   - **`anon` public key** (safe to ship to the browser)
   - **`service_role` key** (server-only — NEVER ship to the browser)

## 2. Local environment variables

Create `.env.local` at the repo root. Add it to `.gitignore` (already
covered by Next.js's default `.gitignore`).

```bash
# .env.local — do NOT commit
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...placeholder

# Server-only — used by edge functions, migrations, server actions
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...placeholder
SUPABASE_DB_URL=postgresql://postgres:<password>@db.your-project-ref.supabase.co:5432/postgres

# App-level
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

| Variable | Where used | Public? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | server / edge functions only | NO |
| `SUPABASE_DB_URL` | migrations + cron | NO |
| `NEXT_PUBLIC_APP_URL` | redirect URLs in auth flows | yes |

For Vercel / Netlify / Render: add the same variables in the project's
environment settings. Mirror the public/private split exactly.

## 3. Install dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Optional but recommended for typed DB access:

```bash
npm install -D supabase
npx supabase login
npx supabase init
npx supabase link --project-ref your-project-ref
```

## 4. Configure Supabase Auth

### 4a. Email + password

1. **Authentication → Providers → Email**.
2. Enable provider. Toggle "Confirm email" on for production; off is OK
   in dev.
3. Customize the confirmation email template if desired.

### 4b. Magic link

1. Same Email provider, ensure "Enable Email OTP" is on.
2. Set the **Redirect URL** to:
   - `http://localhost:3000/auth/callback` (dev)
   - `https://your-domain.com/auth/callback` (prod)
   Add both in **Authentication → URL Configuration → Redirect URLs**.

### 4c. Invite flow assumptions

The MVP plan treats user provisioning as admin-driven, not self-serve:

- **No public sign-up.** In **Authentication → Settings**, disable
  "Allow new users to sign up". Users only enter the system through an
  admin-issued invite.
- Admins (role = `admin` in our app) trigger an invite from the
  `/admin` page. The frontend calls a server action that uses the
  `service_role` key with `supabase.auth.admin.inviteUserByEmail()`.
- The invite email lands the user on a magic-link page that establishes
  the session and then calls our `users` insert (see §6) with their
  initial role (default `writer`).

### 4d. Custom role claims

Supabase Auth holds `auth.users` (immutable identity). Our app role
(`writer | editor | leader | admin`) lives in our `public.users`
table and is mirrored into the JWT via a Postgres trigger so RLS
policies can read it cheaply.

```sql
-- in a migration
create or replace function public.handle_role_claim()
returns trigger language plpgsql security definer as $$
begin
  perform set_config(
    'request.jwt.claim.app_role',
    new.role::text,
    true
  );
  return new;
end;
$$;
```

Read the role inside RLS with `auth.jwt() ->> 'app_role'`. For the
MVP it is also acceptable to read it via a `select role from
public.users where id = auth.uid()` subquery — slower but simpler.

## 5. Connecting Next.js to Supabase

✅ **Implemented.** The project ships with both clients:

- `lib/supabase/browser.ts` → `getSupabaseBrowserClient()` returns a
  cached `SupabaseClient` (or `null` in mock mode).
- `lib/supabase/server.ts`  → `getSupabaseServerClient()` returns a
  cookie-aware client for route handlers and server components (or
  `null` in mock mode).
- `lib/supabase/env.ts`     → `resolveDataMode()` reads
  `NEXT_PUBLIC_DATA_MODE` plus URL/key envs. If supabase mode is
  requested but creds are missing/invalid, it downgrades to mock with
  a console warning.

`lib/session.tsx` now branches on `resolveDataMode()`:

| Mode       | Backing                                                      |
|------------|--------------------------------------------------------------|
| `mock`     | Existing localStorage demo-picker (used by tests / Storybook).|
| `supabase` | Subscribes to `supabase.auth.onAuthStateChange`, fetches the matching `public.users` row to populate `currentUser`. |

Both modes expose the same `useSession()` shape, plus three new
async methods that work in supabase mode:

- `signInWithPassword(email, password)`
- `signInWithMagicLink(email, redirectTo?)`
- `signUpWithPassword(email, password, name)`

The login page (`app/login/page.tsx`) renders the demo picker in mock
mode and an email + password / magic-link form in supabase mode.
Magic-link callbacks land at `/auth/callback`, which exchanges the
code for a session cookie and redirects on.

## 6. Protected routes

The frontend already gates `(app)` via `<AuthGate />`. Two upgrades
when Supabase is wired:

1. **Middleware redirect.** Add `middleware.ts` to refresh the session
   on every request and bounce unauthenticated traffic without flashing
   the loading state.

```ts
// middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => req.cookies.get(n)?.value,
        set: (n, v, o) => res.cookies.set({ name: n, value: v, ...o }),
        remove: (n, o) =>
          res.cookies.set({ name: n, value: "", ...o, maxAge: 0 }),
      },
    }
  );
  const { data } = await supabase.auth.getUser();
  if (!data.user && req.nextUrl.pathname.startsWith("/dashboard")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/board/:path*", "/calendar/:path*",
    "/messages/:path*", "/notifications/:path*", "/announcements/:path*",
    "/team/:path*", "/admin/:path*"],
};
```

2. **Server-component checks.** For any future server components, call
   `createSupabaseServerClient().auth.getUser()` and `notFound()` /
   `redirect("/login")` if unauthenticated.

## 7. Mapping Supabase user → app user record

✅ **Implemented in `supabase/migrations/0004_auth_user_mirror.sql`.**

The migration:

1. Drops the `gen_random_uuid()` default on `public.users.id` so
   `auth.uid()` is the authoritative source of new ids.
2. Adds a foreign key `public.users.id → auth.users.id` (skipped
   gracefully on standalone Postgres environments without an `auth`
   schema, e.g. CI).
3. Installs `public.handle_new_user()` — `security definer`, runs on
   every new `auth.users` row. It populates `name` from
   `raw_user_meta_data.name` (falling back to the email local-part),
   `role` from `raw_user_meta_data.role` (falling back to `writer`),
   and is idempotent (`on conflict (id) do update`) so re-runs are
   safe.
4. Adds the trigger `on_auth_user_created` on `auth.users`.
5. Adds a diagnostic view `public.auth_users_unmirrored` listing any
   `auth.users` rows that don't have a matching `public.users` row.

Apply with:

```bash
npx supabase db push   # picks up 0001 + 0002 + 0003 + 0004
# or paste 0004_auth_user_mirror.sql into the SQL editor
```

The frontend's `useSession().currentUser` resolves via:

```ts
const { data: profile } = await client
  .from("users")
  .select("id, name, email, role, avatar_url, active")
  .eq("id", supabaseUser.id)
  .maybeSingle();
```

(Implemented in `lib/session.tsx → fetchProfile`.)

### Promoting the first admin

`handle_new_user` always inserts new accounts as `writer`. To bootstrap
an admin:

```sql
update public.users set role = 'admin' where email = 'you@yourdomain.com';
```

After the role is updated, sign out and back in so the JWT picks up
the new claim (or rely on the `current_app_role()` helper, which
reads `public.users.role` as a fallback).

### Testing signup / login locally

1. Apply migrations (see above) and confirm RLS is enabled on
   `public.users`.
2. Set in `.env.local`:
   ```bash
   NEXT_PUBLIC_DATA_MODE=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
3. Restart `npm run dev`.
4. Visit `/login`. You should see the email + password / magic-link
   form (NOT the demo picker).
5. **Sign up:** click *Sign up*, enter a display name + email +
   password (≥ 8 chars). If "Confirm email" is enabled in Supabase,
   check the inbox; otherwise you're signed in immediately.
6. **Sign in:** click *Sign in*, enter the same email + password.
7. **Magic link:** click *Magic link*, enter your email, click the
   link in the inbox. It lands on `/auth/callback`, which sets the
   session cookie and redirects to `/dashboard`.
8. After signing in, run in the SQL editor:
   ```sql
   select id, name, email, role, active from public.users
   where id = auth.uid();
   ```
   You should get exactly one row with the correct email and
   `role = 'writer'` (unless you bootstrapped an admin above).
9. Sign out via the avatar menu in the top bar; you should land back
   on `/login`.

### Resetting local state

- Wipe the Supabase auth users (Auth → Users → delete) — the FK
  cascade will remove the matching `public.users` row.
- Clear browser cookies for `http://localhost:3000` to drop any
  cached Supabase session cookie.
- For mock mode resets, clear `localStorage` key
  `advantage-portal:session` (or click *Sign out* and pick a fresh
  demo user).

## 8. RLS strategy

Turn RLS on for every table:

```sql
alter table public.tasks enable row level security;
alter table public.submissions enable row level security;
-- ...same for reviews, comments, conversations, messages,
--    notifications, conversation_members
```

Then per table:

### `users`
- SELECT: any authenticated user.
- UPDATE / DELETE: only `app_role = 'admin'` and `id <> auth.uid()`.

### `tasks`
- SELECT:
  `auth.jwt()->>'app_role' in ('leader','admin')`
  OR `writer_id = auth.uid()`
  OR `editor_id = auth.uid()`.
- INSERT / UPDATE: `app_role in ('leader','admin')`.

### `submissions`
- SELECT: visible if the related task is visible to the user (subquery).
- INSERT: only the writer of the task.

### `reviews`
- SELECT: same visibility as the parent submission.
- INSERT: editor assigned OR `app_role in ('leader','admin')`,
  AND `task.status = 'submitted'`,
  AND `reviewer_id <> task.writer_id`.

### `comments`
- SELECT / INSERT: same visibility as the parent submission;
  inline comments must include `submission_id` AND `line_number`.

### `conversations` + `conversation_members`
- SELECT: only members of the conversation.
- `all_team` channel: members include everyone in `users`.

### `messages`
- SELECT: members of the parent conversation.
- INSERT: members; for `all_team`, only `app_role in ('leader','admin')`.

### `notifications`
- SELECT / UPDATE: only `user_id = auth.uid()`.
- INSERT: server-only (use `service_role` from edge functions).

The frontend permission checks in `lib/permissions.ts` are now a
defense-in-depth layer on top of these RLS policies.

## 9. Storage buckets for submissions / attachments

Two buckets:

- **`submissions-files`** — file submissions. Private. Read access via
  signed URLs only.
- **`avatars`** — user avatars. Public, with size limit.

```sql
insert into storage.buckets (id, name, public)
values ('submissions-files', 'submissions-files', false),
       ('avatars',           'avatars',           true);
```

Submission upload path convention: `{taskId}/{submissionId}/{filename}`.
Generate a signed URL with `supabase.storage.from('submissions-files')
.createSignedUrl(path, 60 * 5)` when the user clicks "Open" or
"Download" in the SubmissionViewer card.

Storage RLS policies should mirror submission visibility — the simplest
shape is an `auth.uid()` check that joins back to the `submissions`
table.

## 10. Realtime channels for tasks / messages / notifications

Enable Realtime for the relevant tables in **Database → Replication**:
- `tasks`
- `submissions`
- `reviews`
- `comments`
- `messages`
- `notifications`

In the frontend, subscribe inside the relevant data hook. Example for
notifications:

```ts
useEffect(() => {
  if (!currentUser) return;
  const channel = supabase
    .channel(`notifications:${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${currentUser.id}`,
      },
      () => refetch()
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [currentUser?.id, refetch]);
```

The same pattern fits `messages:conversation_id=eq.<id>` for the chat
view and `tasks` (no filter) for the kanban board.

## 11. What stays mocked vs. real

| Surface | After this guide is followed |
| --- | --- |
| Auth | ✅ Real (Supabase Auth) |
| Tasks / submissions / reviews / comments | ✅ Real (Postgres + RLS) |
| Messaging | ✅ Real (Postgres + Realtime) |
| Notifications (bell, popover, page) | ✅ Real (Postgres + Realtime) |
| Deadline scan | ✅ Real (Edge Function or `pg_cron`, same scanner) |
| File uploads | ✅ Real (Storage bucket, signed URLs) |
| Google Doc previews | ⚠️ Still placeholder. Embedding requires Google API + per-user OAuth scopes — out of scope for the first backend pass. |
| Inline Markdown rendering | ⚠️ Still plain text + line numbers. A real Markdown renderer (`react-markdown` + `rehype-sanitize`) is a separate UI task. |
| Search (top bar) | ⚠️ Still mocked. Postgres full-text search is straightforward to add later. |
| @mentions / typing indicators / read receipts | ⚠️ Still out of scope. |
| Audit logs / org separation | ⚠️ Still out of scope. |

## 12. Sanity checklist before flipping the adapter

- [ ] All `.env` variables present in dev AND prod environments.
- [ ] `npm run build` succeeds.
- [ ] Supabase project's Auth providers are enabled and redirect URLs
      match `NEXT_PUBLIC_APP_URL`.
- [ ] Trigger or server action populates `public.users` for every new
      `auth.users` row.
- [ ] RLS is ON for every table; `select * from <table>` as an
      anonymous client returns zero rows.
- [ ] The Realtime channels listed in §10 deliver test events.
- [ ] In `lib/api/provider.tsx`, the active client is the
      `HttpApiClient` and `mode === "http"`.
- [ ] `useSession()` returns a real Supabase user — confirm via the
      avatar menu.
- [ ] `npm run dev` clicks through every page in the demo script with
      no console errors.
