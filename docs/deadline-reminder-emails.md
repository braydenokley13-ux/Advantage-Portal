# Deadline reminder emails

Open tasks get an automatic nudge — in-app **and** by email — as their deadline
approaches:

| When                | Goes to                                  |
| ------------------- | ---------------------------------------- |
| 7 days out          | writer + editor                          |
| 3 days out          | writer + editor                          |
| 1 day out           | writer + editor                          |
| Overdue (past due)  | writer + editor + every active **leader**|

Each (task, mark, recipient) reminder is sent **once** — recorded in the
`deadline_reminders_sent` table — so reruns and lingering overdue tasks never
re-spam anyone.

## How it runs

There is **no always-on background worker** in this app, so reminders can't fire
on their own. A scheduler has to call the endpoint:

```
POST /api/cron/deadline-reminders
Authorization: Bearer <CRON_SECRET>
```

The endpoint (`app/api/cron/deadline-reminders/route.ts`):

1. loads open tasks + active users with the Supabase service-role key,
2. runs the shared `scanDeadlineReminders` logic,
3. writes an in-app `deadline` notification per reminder,
4. emails each recipient the branded notification template,
5. records what it sent so nothing repeats.

It only does real work in **Supabase mode** with SMTP configured (see
`.env.example`). Without SMTP it still posts the in-app notifications and reports
`emailConfigured: false`.

## Scheduling on a free plan (we are not paying for Vercel)

This matters: **Vercel's free "Hobby" plan caps cron jobs at one run per day.**
That has real consequences for this feature, because the scan fires on *exact*
day boundaries (7, 3, 1, overdue):

- A once-a-day run normally hits each boundary fine.
- But if that single daily run is skipped or delayed across a day boundary, that
  task's 7d/3d/1d reminder for that day is **missed** (overdue is still caught
  the next day). Hobby cron also doesn't guarantee a precise run time.

So `vercel.json` ships a daily cron as a baseline, but the **recommended free
option is GitHub Actions**, which is free and can run hourly — reliably catching
every day boundary. The dedupe table makes the extra runs harmless.

### Option A — GitHub Actions (recommended, free, hourly)

Already wired in `.github/workflows/deadline-reminders.yml`. Just add two repo
secrets (**Settings → Secrets and variables → Actions**):

- `DEADLINE_CRON_URL` = `https://<your-app>/api/cron/deadline-reminders`
- `CRON_SECRET` = the same value as the app's `CRON_SECRET`

The workflow no-ops (stays green) until both secrets exist. Note GitHub may delay
scheduled runs when the platform is busy; the dedupe makes that safe.

### Option B — Vercel Hobby cron (once per day)

`vercel.json` declares the cron. Set `CRON_SECRET` in the Vercel project env;
Vercel Cron automatically sends it as a Bearer token. Remember: **once per day
only** on the free plan.

### Option C — any external cron (cron-job.org, etc.)

Point a free scheduler at:

```
https://<your-app>/api/cron/deadline-reminders?secret=<CRON_SECRET>
```

(The `?secret=` form exists for schedulers that can't set an `Authorization`
header.) Avoid putting the secret in the URL where request logs are public.

## Other free-tier things to keep in mind

- **Serverless time limits.** Hobby functions are short-lived (the route sets
  `maxDuration = 60`). Emails send one at a time over SMTP; for a small
  newsroom this is fine, but a very large backlog could approach the limit. If
  that ever happens, batch across runs (the dedupe already supports partial
  progress) or move to a queue/provider API.
- **Gmail SMTP limits.** The default Gmail App Password path has daily send
  caps. Fine for a class-sized team; switch to a real provider (Resend,
  Postmark, SES) for volume.
- **No persistent in-memory state.** Each invocation is cold, which is exactly
  why dedupe lives in Postgres (`deadline_reminders_sent`) rather than memory.

## Migration

Apply `supabase/migrations/0008_deadline_reminders.sql` before first run.
