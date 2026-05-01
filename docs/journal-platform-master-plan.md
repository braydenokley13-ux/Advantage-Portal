# Journal Writing Team Management Platform — Master Plan

> **Brand note:** "The Advantage Journal" is the brand name of a student newspaper / online publication (theadvantagejournal.org). This portal is the newsroom operating system for that publication. Wherever this older planning doc says "writing team" or "journal," read it as "student newsroom" and "publication." Newer phases (see `newsroom-workflow-implementation-plan.md`) introduce sections, pitches, issues, copy desk, fact-checking, and sensitive-story escalation on top of the base model below.

**Audience:** Engineering + Product
**Scale target:** ~40 active users, ~200 active tasks, low concurrent write load
**Platforms:** Web (responsive) + iOS + Android
**Language:** English
**Status:** Planning document — not implementation

---

## PHASE 1 — SYSTEM FOUNDATION

### 1. System Architecture

#### 1.1 Architectural Style
- **Pattern:** Modular monolith backend + thin clients (web + mobile).
- **Why:** ~40 users does not justify microservices. A single deployable service reduces operational cost and accelerates iteration. Internal modules are bounded so future extraction is cheap.

#### 1.2 Component Map

| Layer | Choice | Rationale |
|---|---|---|
| Web client | Next.js 14 (App Router, React 18, TypeScript) | SSR for auth-gated pages, single codebase for marketing + app |
| Mobile client | React Native (Expo, TypeScript) | Code reuse with web (shared types, API client, validation), single team |
| API | Node.js 20 + Fastify (TypeScript) | Lower overhead than Express, schema-first via JSON Schema/Zod |
| Auth | Auth via Supabase Auth (email + magic link + password), JWT issued to clients | Off-the-shelf, supports RLS handoff, mobile-friendly |
| Database | PostgreSQL 16 (managed: Supabase or Neon) | Relational fit for tasks, comments, RBAC; row-level security available |
| Realtime | Supabase Realtime (Postgres logical replication → WebSocket) for messages, kanban, notifications | Avoids running our own WS infra; scales for 40 users trivially |
| File storage | S3-compatible object store (Supabase Storage or AWS S3) | Submissions, attachments, avatars |
| Background jobs | pg-boss (Postgres-backed queue) | No extra infra; handles deadline reminders, notification fan-out, email |
| Push notifications | Expo Push (mobile) + Web Push (VAPID) | Unified across platforms; Expo handles APNs + FCM |
| Email | Resend or Postmark | Transactional only (invites, password reset, deadline digests) |
| Search | Postgres full-text (tsvector) | 40 users — no Elastic/Meilisearch needed |
| Observability | Sentry (errors) + Logtail/BetterStack (logs) + UptimeRobot | Minimal viable observability |
| CI/CD | GitHub Actions → Vercel (web) + EAS (mobile) + Fly.io/Render (API) | Standard, low-friction |

#### 1.3 Request Topology

```
[ Web (Next.js) ]──┐
                   ├──HTTPS──▶ [ API: Fastify ]──▶ [ Postgres ]
[ Mobile (RN)  ]──┘                │                    ▲
                                   ├──▶ [ pg-boss jobs ]┘
                                   ├──▶ [ Object Storage ]
                                   └──▶ [ Push / Email providers ]

[ Realtime (Supabase) ]◀──Postgres WAL──[ Postgres ]
        ▲
        └── WebSocket subscriptions from Web + Mobile
```

#### 1.4 Realtime Strategy
- **Primary channel:** Supabase Realtime subscriptions on `messages`, `task_cards`, `notifications` rows scoped by RLS policies.
- **Fallback:** Clients poll on reconnect (last-seen cursor) to backfill missed events.
- **No custom socket server in MVP.**

#### 1.5 Environments
- `local` (docker-compose: Postgres + Mailhog + MinIO)
- `staging` (full managed stack, seeded data, separate auth tenant)
- `production`

#### 1.6 Non-Functional Targets (MVP)
- API p95 latency: < 300 ms for read endpoints, < 600 ms for writes
- Realtime delivery: < 1 s end-to-end
- Availability: 99.5% (single-region acceptable at this scale)
- RPO: 24 h (daily DB snapshot); RTO: 4 h
- All traffic TLS 1.2+; JWT short-lived (1 h) + refresh tokens (30 d)

#### 1.7 Key Architectural Decisions (locked for MVP)
1. Modular monolith, not microservices.
2. Supabase stack (Auth + Postgres + Realtime + Storage) to eliminate undifferentiated infra work.
3. Single shared TypeScript package for API contracts (`@journal/contracts`) consumed by web, mobile, and API.
4. RBAC enforced in **two layers**: Postgres RLS (data) + API middleware (operations).
5. No in-app rich text editor in MVP beyond plain markdown; Google Doc link + file upload cover the gap.

---

### 2. Core Entities Overview

The system is organized around **eight core entities**. Everything else (notifications, calendar views, kanban) is a derived projection.

| # | Entity | Purpose | Owns | Key Relationships |
|---|---|---|---|---|
| 1 | `User` | Identity + profile | email, name, avatar, role, timezone | has many Tasks (as writer/editor), Memberships, Messages |
| 2 | `Role` | RBAC role assignment | role enum (writer/editor/leader/admin) | belongs to User (1:1 in MVP) |
| 3 | `Task` | A writing assignment | title, instructions, deadline, status, color computed | belongs to writer (User), optional editor (User), created_by (User) |
| 4 | `Submission` | Writer's deliverable for a Task | type (file/google_doc/inline), payload, version | belongs to Task; has many Reviews, Comments |
| 5 | `Review` | Editor decision on a Submission | decision (approved/changes_requested/rejected), summary | belongs to Submission, reviewer (User) |
| 6 | `Comment` | Inline or general comment | body, anchor (line/range or null = general), resolved | belongs to Submission, author (User), optional parent_comment |
| 7 | `Conversation` | Messaging container | type (dm/group/all_team/issue_channel), name, created_by | has many Memberships, Messages |
| 8 | `Message` | Chat message | body, attachments, pinned | belongs to Conversation, sender (User); has many Reads |

#### 2.1 Supporting Entities

| Entity | Role |
|---|---|
| `ConversationMember` | Join table: User ↔ Conversation, plus per-user state (last_read_at, muted) |
| `MessageRead` | Per-recipient read receipt (user_id, message_id, read_at) |
| `Attachment` | File metadata (storage key, mime, size) attached to Message or Submission |
| `Notification` | Per-user delivered notification (event type, payload, read_at, channels) |
| `KanbanColumn` | Custom columns added by Leaders (board_id, name, order, status_mapping) |
| `CalendarEvent` (view) | Materialized projection of Tasks → calendar entries for filtering |
| `AuditLog` | Append-only record of permissioned actions (who did what, when) |
| `PushToken` | Per-device push token (Expo/Web Push) for a User |

#### 2.2 Entity Boundaries (Domain Modules)

- **identity** — User, Role, PushToken, AuditLog
- **work** — Task, KanbanColumn, CalendarEvent
- **review** — Submission, Review, Comment, Attachment(submission)
- **messaging** — Conversation, ConversationMember, Message, MessageRead, Attachment(message)
- **notify** — Notification, delivery dispatcher

These modules map 1:1 to API route groups and to migration files for clean ownership.

#### 2.3 ID + Timestamp Conventions
- All IDs: `uuid v7` (time-ordered, index-friendly).
- All tables include: `created_at timestamptz`, `updated_at timestamptz`, soft-deletable tables include `deleted_at timestamptz null`.
- All user-facing times stored as `timestamptz` (UTC); rendered in user's timezone (`User.timezone`, IANA string).

---

## PHASE 2 — DATA MODEL

### 3. Full Database Schema (Postgres)

All tables use `uuid` PKs (default `uuid_generate_v7()`), `timestamptz` for all time columns, and `not null` unless stated. Enums are Postgres `ENUM` types.

#### 3.1 Enums

```sql
CREATE TYPE user_role        AS ENUM ('writer','editor','leader','admin');
CREATE TYPE task_status      AS ENUM ('not_started','in_progress','submitted','complete');
CREATE TYPE task_color       AS ENUM ('green','amber','red');  -- computed, but stored for query speed
CREATE TYPE submission_type  AS ENUM ('file','google_doc','inline');
CREATE TYPE review_decision  AS ENUM ('approved','changes_requested','rejected');
CREATE TYPE conversation_type AS ENUM ('dm','group','all_team','issue_channel');
CREATE TYPE notification_kind AS ENUM (
  'task_assigned','deadline_7d','deadline_3d','deadline_1d','deadline_missed',
  'submission_created','comment_added','review_decided','task_completed',
  'message_received','announcement_pinned'
);
CREATE TYPE delivery_channel AS ENUM ('in_app','push','email');
```

#### 3.2 Identity

```sql
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  email           citext UNIQUE NOT NULL,
  name            text NOT NULL,
  avatar_url      text,
  role            user_role NOT NULL DEFAULT 'writer',
  timezone        text NOT NULL DEFAULT 'UTC',     -- IANA, e.g. 'America/Denver'
  is_active       boolean NOT NULL DEFAULT true,
  last_seen_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX users_role_idx ON users(role) WHERE deleted_at IS NULL;

CREATE TABLE push_tokens (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    text NOT NULL CHECK (platform IN ('ios','android','web')),
  token       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,             -- e.g. 'task.create', 'user.role_change'
  entity      text NOT NULL,             -- 'task','user','submission'
  entity_id   uuid,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON audit_log(entity, entity_id);
CREATE INDEX audit_actor_idx  ON audit_log(actor_id, created_at DESC);
```

#### 3.3 Work / Tasks

```sql
CREATE TABLE kanban_boards (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  name        text NOT NULL DEFAULT 'Main',
  is_default  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kanban_columns (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  board_id        uuid NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
  name            text NOT NULL,
  position        integer NOT NULL,
  status_mapping  task_status,             -- nullable for custom columns
  is_system       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, position)
);

CREATE TABLE tasks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  board_id        uuid NOT NULL REFERENCES kanban_boards(id),
  column_id       uuid NOT NULL REFERENCES kanban_columns(id),
  title           text NOT NULL,
  instructions    text,
  writer_id       uuid NOT NULL REFERENCES users(id),
  editor_id       uuid REFERENCES users(id),
  created_by      uuid NOT NULL REFERENCES users(id),
  deadline_at     timestamptz NOT NULL,
  deadline_tz     text NOT NULL,            -- IANA tz used when leader set deadline
  status          task_status NOT NULL DEFAULT 'not_started',
  color           task_color NOT NULL DEFAULT 'green',  -- recomputed by trigger/job
  position        integer NOT NULL DEFAULT 0,           -- order within column
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX tasks_writer_idx   ON tasks(writer_id) WHERE deleted_at IS NULL;
CREATE INDEX tasks_editor_idx   ON tasks(editor_id) WHERE deleted_at IS NULL;
CREATE INDEX tasks_status_idx   ON tasks(status, deadline_at);
CREATE INDEX tasks_deadline_idx ON tasks(deadline_at) WHERE status <> 'complete';
```

#### 3.4 Submissions + Review

```sql
CREATE TABLE submissions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  submitter_id    uuid NOT NULL REFERENCES users(id),
  type            submission_type NOT NULL,
  google_doc_url  text,
  inline_body     text,                                     -- markdown
  version         integer NOT NULL DEFAULT 1,
  is_current      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (type='google_doc' AND google_doc_url IS NOT NULL) OR
    (type='inline'     AND inline_body    IS NOT NULL) OR
    (type='file')     -- file payload represented in attachments
  )
);
CREATE INDEX submissions_task_idx ON submissions(task_id, version DESC);
CREATE UNIQUE INDEX submissions_one_current_idx
  ON submissions(task_id) WHERE is_current = true;

CREATE TABLE reviews (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  submission_id   uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_id     uuid NOT NULL REFERENCES users(id),
  decision        review_decision NOT NULL,
  summary         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_submission_idx ON reviews(submission_id, created_at DESC);

CREATE TABLE comments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  submission_id   uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES users(id),
  parent_id       uuid REFERENCES comments(id) ON DELETE CASCADE,
  body            text NOT NULL,
  anchor          jsonb,                       -- null = general; { "line": int, "range": [start,end] } for inline
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_submission_idx ON comments(submission_id, created_at);
```

#### 3.5 Messaging

```sql
CREATE TABLE conversations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  type            conversation_type NOT NULL,
  name            text,                          -- null for dm
  created_by      uuid REFERENCES users(id),
  is_announcement boolean NOT NULL DEFAULT false, -- true for 'all_team' or leader-pinned
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX conversations_all_team_singleton
  ON conversations((type)) WHERE type='all_team';

CREATE TABLE conversation_members (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  muted           boolean NOT NULL DEFAULT false,
  last_read_at    timestamptz,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX cm_user_idx ON conversation_members(user_id);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES users(id),
  body            text,
  pinned_at       timestamptz,
  edited_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX messages_conv_idx ON messages(conversation_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE message_reads (
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE attachments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  owner_kind      text NOT NULL CHECK (owner_kind IN ('message','submission')),
  owner_id        uuid NOT NULL,
  uploader_id     uuid NOT NULL REFERENCES users(id),
  storage_key     text NOT NULL,
  filename        text NOT NULL,
  mime_type       text NOT NULL,
  size_bytes      bigint NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_owner_idx ON attachments(owner_kind, owner_id);
```

#### 3.6 Notifications

```sql
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            notification_kind NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { task_id, message_id, ... }
  channels        delivery_channel[] NOT NULL DEFAULT ARRAY['in_app']::delivery_channel[],
  read_at         timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx
  ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
```

#### 3.7 Triggers (essentials)
- `tasks` `BEFORE UPDATE` → set `updated_at = now()`.
- `tasks` `AFTER UPDATE OF deadline_at, status` → recompute `color` (green/amber/red).
- `submissions` `BEFORE INSERT` → set previous current = false; new row `is_current = true`.
- `comments` `BEFORE UPDATE` → set `updated_at = now()`.
- `messages` `AFTER INSERT` → emit `notify` payload for realtime fan-out (handled by Supabase Realtime publication).

---

### 4. Relationships + Constraints

#### 4.1 ER Summary

```
users 1──* tasks (writer_id)
users 1──* tasks (editor_id, nullable)
users 1──* tasks (created_by)

tasks 1──* submissions
submissions 1──* reviews
submissions 1──* comments      comments 1──* comments (parent_id, threaded)

users 1──* submissions (submitter_id)
users 1──* reviews (reviewer_id)
users 1──* comments (author_id)

kanban_boards 1──* kanban_columns
kanban_columns 1──* tasks

conversations 1──* conversation_members *──1 users
conversations 1──* messages *──1 users (sender_id)
messages 1──* message_reads *──1 users

attachments *──1 (messages | submissions)   -- polymorphic

users 1──* notifications
users 1──* push_tokens
users 1──* audit_log (actor_id)
```

#### 4.2 Referential Integrity Rules

| Relationship | On parent delete | Reason |
|---|---|---|
| `tasks.writer_id → users.id` | RESTRICT | Never silently lose work; admin must reassign first |
| `tasks.editor_id → users.id` | SET NULL | Editor reassignment is normal |
| `tasks.created_by → users.id` | RESTRICT | Preserve provenance |
| `submissions.task_id → tasks.id` | CASCADE | Task removal removes its submissions |
| `reviews.submission_id → submissions.id` | CASCADE | |
| `comments.submission_id → submissions.id` | CASCADE | |
| `comments.parent_id → comments.id` | CASCADE | Deleting parent removes thread |
| `conversation_members.* → conversations/users` | CASCADE | Membership is dependent state |
| `messages.conversation_id → conversations.id` | CASCADE | |
| `message_reads.message_id → messages.id` | CASCADE | |
| `attachments` (polymorphic) | manual cleanup job | Polymorphic FK not enforceable; nightly orphan sweep |
| `notifications.user_id → users.id` | CASCADE | |
| `push_tokens.user_id → users.id` | CASCADE | |
| `audit_log.actor_id → users.id` | SET NULL | Keep history even after user deletion |

#### 4.3 Soft Delete Policy
Soft-deletable: `users`, `tasks`, `messages`. All others hard-delete. Soft-deleted rows are excluded from all default queries via `WHERE deleted_at IS NULL` and from RLS policies.

#### 4.4 Cross-Table Invariants (enforced in DB)

1. **One current submission per task**
   `UNIQUE INDEX submissions_one_current_idx ON submissions(task_id) WHERE is_current = true;`

2. **Editor must differ from writer**
   ```sql
   ALTER TABLE tasks ADD CONSTRAINT tasks_editor_not_writer
     CHECK (editor_id IS NULL OR editor_id <> writer_id);
   ```

3. **Reviewer must be the assigned editor or a leader/admin** — enforced in API + RLS (not pure SQL).

4. **Submission submitter must be the task's writer** — enforced via trigger:
   ```sql
   CREATE FUNCTION enforce_submission_author() RETURNS trigger AS $$
   BEGIN
     IF NEW.submitter_id <> (SELECT writer_id FROM tasks WHERE id = NEW.task_id) THEN
       RAISE EXCEPTION 'submission.submitter_id must equal task.writer_id';
     END IF;
     RETURN NEW;
   END $$ LANGUAGE plpgsql;
   CREATE TRIGGER trg_submission_author BEFORE INSERT ON submissions
     FOR EACH ROW EXECUTE FUNCTION enforce_submission_author();
   ```

5. **DM conversations must have exactly 2 members** — enforced via deferred trigger after insert of members:
   ```sql
   -- pseudocode: AFTER INSERT/DELETE on conversation_members
   -- IF conv.type='dm' AND member_count <> 2 THEN RAISE.
   ```

6. **All-Team conversation is a singleton** — enforced by partial unique index in §3.5.

7. **Kanban column status_mapping uniqueness per board** — system columns map to one `task_status` each:
   ```sql
   CREATE UNIQUE INDEX kanban_columns_status_per_board
     ON kanban_columns(board_id, status_mapping)
     WHERE status_mapping IS NOT NULL;
   ```

8. **Task status must match its column's status_mapping** when column is a system column — enforced by trigger on `tasks` insert/update.

9. **Comment anchor schema** — JSONB validated by `CHECK (anchor IS NULL OR jsonb_typeof(anchor)='object')` plus app-level Zod validation.

#### 4.5 Indexing Strategy (summary)

| Query | Index |
|---|---|
| Writer's open tasks | `tasks(writer_id) WHERE deleted_at IS NULL` |
| Editor's queue | `tasks(editor_id) WHERE deleted_at IS NULL` |
| Kanban board read | `tasks(column_id, position)` |
| Deadline reminder cron | `tasks(deadline_at) WHERE status <> 'complete'` |
| Conversation list | `conversation_members(user_id)` |
| Conversation scrollback | `messages(conversation_id, created_at DESC)` |
| Unread notifications | `notifications(user_id, created_at DESC) WHERE read_at IS NULL` |
| Submission history | `submissions(task_id, version DESC)` |

#### 4.6 Data Volume Estimate (1 year, 40 users)
- Tasks: ~40 × 4/mo × 12 = ~2k rows
- Submissions: ~3 versions/task ≈ 6k
- Comments: ~5/submission ≈ 30k
- Messages: ~50/user/day × 40 × 250 days ≈ 500k
- Notifications: ~20/user/day × 40 × 365 ≈ 290k

Total well under 1M rows in the largest table — single-node Postgres is more than sufficient. No partitioning needed in MVP.

---

## PHASE 3 — PERMISSIONS SYSTEM

### 5. RBAC Matrix

Roles: **writer**, **editor**, **leader**, **admin**. Roles are hierarchical for *most* operations (admin > leader > editor > writer), but a few capabilities (editor review actions) are scoped by *assignment* not rank.

Legend: ✅ allowed · ⚠️ scoped (see notes) · ❌ denied

#### 5.1 Tasks

| Action | Writer | Editor | Leader | Admin |
|---|:--:|:--:|:--:|:--:|
| Create task | ❌ | ❌ | ✅ | ✅ |
| View task | ⚠️ own | ⚠️ assigned | ✅ all | ✅ all |
| Update title/instructions | ❌ | ❌ | ✅ | ✅ |
| Update deadline | ❌ | ❌ | ✅ | ✅ |
| Reassign writer/editor | ❌ | ❌ | ✅ | ✅ |
| Move card (drag) | ❌ | ❌ | ✅ | ✅ |
| Change status (via submission/review) | ⚠️ submit only | ⚠️ via review | ✅ any | ✅ any |
| Delete task (soft) | ❌ | ❌ | ✅ | ✅ |

#### 5.2 Submissions

| Action | Writer | Editor | Leader | Admin |
|---|:--:|:--:|:--:|:--:|
| Create submission | ⚠️ own task only | ❌ | ❌ | ✅ (rare; admin override) |
| View submission | ⚠️ own | ⚠️ assigned | ✅ | ✅ |
| Replace (new version) | ⚠️ own task, status ≠ complete | ❌ | ❌ | ✅ |
| Delete submission | ❌ | ❌ | ⚠️ if not reviewed | ✅ |

#### 5.3 Reviews + Comments

| Action | Writer | Editor | Leader | Admin |
|---|:--:|:--:|:--:|:--:|
| Create review (decide) | ❌ | ⚠️ assigned editor | ✅ | ✅ |
| View review | ⚠️ own task | ⚠️ assigned | ✅ | ✅ |
| Add comment (general) | ⚠️ own submission | ⚠️ assigned | ✅ | ✅ |
| Add inline comment | ⚠️ own submission | ⚠️ assigned | ✅ | ✅ |
| Resolve comment | ⚠️ own | ⚠️ assigned | ✅ | ✅ |
| Edit own comment | ✅ | ✅ | ✅ | ✅ |
| Delete any comment | ❌ | ❌ | ⚠️ on tasks they own | ✅ |

#### 5.4 Kanban

| Action | Writer | Editor | Leader | Admin |
|---|:--:|:--:|:--:|:--:|
| View board | ⚠️ own cards only | ⚠️ assigned cards only | ✅ full | ✅ full |
| Add column | ❌ | ❌ | ✅ | ✅ |
| Reorder columns | ❌ | ❌ | ✅ | ✅ |
| Drag any card | ❌ | ❌ | ✅ | ✅ |
| Drag own card between writer-allowed states | ⚠️ `not_started` ↔ `in_progress` only | ❌ | ✅ | ✅ |

#### 5.5 Messaging

| Action | Writer | Editor | Leader | Admin |
|---|:--:|:--:|:--:|:--:|
| Open DM with any user | ✅ | ✅ | ✅ | ✅ |
| Create group chat | ❌ | ❌ | ✅ | ✅ |
| Create issue/section channel | ❌ | ❌ | ✅ | ✅ |
| Post in `all_team` | ❌ | ❌ | ✅ | ✅ |
| Read `all_team` | ✅ | ✅ | ✅ | ✅ |
| Pin message | ❌ | ❌ | ⚠️ in own channels | ✅ |
| Delete own message | ✅ | ✅ | ✅ | ✅ |
| Delete others' message | ❌ | ❌ | ⚠️ in own channels | ✅ |
| Add/remove members | ❌ | ❌ | ⚠️ in own channels | ✅ |

#### 5.6 Calendar

| Action | Writer | Editor | Leader | Admin |
|---|:--:|:--:|:--:|:--:|
| View own deadlines | ✅ | ✅ | ✅ | ✅ |
| View master calendar | ❌ | ❌ | ✅ | ✅ |
| Filter master calendar | — | — | ✅ | ✅ |

#### 5.7 Users + Admin

| Action | Writer | Editor | Leader | Admin |
|---|:--:|:--:|:--:|:--:|
| Invite user | ❌ | ❌ | ❌ | ✅ |
| Change user role | ❌ | ❌ | ❌ | ✅ |
| Deactivate user | ❌ | ❌ | ❌ | ✅ |
| View audit log | ❌ | ❌ | ⚠️ on entities they own | ✅ |
| Settings (workspace) | ❌ | ❌ | ❌ | ✅ |

#### 5.8 Notifications
- Every user reads/dismisses **only their own** notifications. No cross-user access.

---

### 6. Enforcement Logic

Permissions are enforced **twice** to ensure no path bypasses them:

```
Layer A: API middleware (Fastify hooks)
   └── Validates JWT → resolves role + user_id
   └── Calls policy fn `can(user, action, resource)`
   └── 403 on deny, before DB access

Layer B: Postgres Row-Level Security (RLS)
   └── Every table has policies keyed off `current_user_id()` and `current_user_role()`
   └── Even a leaked service-key request cannot read across boundaries
```

#### 6.1 JWT → DB Context

The API sets two GUC vars per request via `SET LOCAL`:

```sql
SET LOCAL app.user_id  = '<uuid>';
SET LOCAL app.user_role = '<role>';
```

Helpers:

```sql
CREATE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

CREATE FUNCTION current_user_role() RETURNS user_role AS $$
  SELECT nullif(current_setting('app.user_role', true), '')::user_role
$$ LANGUAGE sql STABLE;

CREATE FUNCTION is_leader_or_admin() RETURNS boolean AS $$
  SELECT current_user_role() IN ('leader','admin')
$$ LANGUAGE sql STABLE;
```

#### 6.2 RLS Policies (representative)

```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_read ON tasks FOR SELECT USING (
  is_leader_or_admin()
  OR writer_id = current_user_id()
  OR editor_id = current_user_id()
);

CREATE POLICY tasks_insert ON tasks FOR INSERT WITH CHECK (
  is_leader_or_admin()
);

CREATE POLICY tasks_update ON tasks FOR UPDATE USING (
  is_leader_or_admin()
  -- writer can only move own card between not_started/in_progress;
  -- enforced by trigger that diff-checks NEW vs OLD
  OR (writer_id = current_user_id())
) WITH CHECK (
  is_leader_or_admin() OR writer_id = current_user_id()
);

CREATE POLICY tasks_delete ON tasks FOR DELETE USING (is_leader_or_admin());
```

```sql
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY submissions_read ON submissions FOR SELECT USING (
  is_leader_or_admin()
  OR EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = submissions.task_id
      AND (t.writer_id = current_user_id() OR t.editor_id = current_user_id())
  )
);

CREATE POLICY submissions_insert ON submissions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_id AND t.writer_id = current_user_id()
      AND t.status <> 'complete'
  ) OR current_user_role() = 'admin'
);
```

```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_read ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = messages.conversation_id
      AND cm.user_id = current_user_id()
  )
);

CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
  sender_id = current_user_id()
  AND EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = conversation_id
      AND cm.user_id = current_user_id()
  )
  -- all_team posting restricted to leader/admin
  AND NOT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
      AND c.type = 'all_team'
      AND current_user_role() NOT IN ('leader','admin')
  )
);
```

```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_self ON notifications FOR ALL USING (user_id = current_user_id())
                                            WITH CHECK (user_id = current_user_id());
```

#### 6.3 API Policy Layer (TypeScript)

A single `policies` module mirrors the matrix:

```ts
// apps/api/src/policies/index.ts
type Action =
  | 'task.create' | 'task.update' | 'task.delete' | 'task.move'
  | 'submission.create' | 'review.create'
  | 'message.post' | 'channel.create' | 'user.manage';

interface Ctx { userId: string; role: UserRole }

export const can = {
  'task.create':   (c: Ctx) => c.role === 'leader' || c.role === 'admin',
  'task.update':   (c: Ctx) => c.role === 'leader' || c.role === 'admin',
  'task.move':     (c: Ctx, t: Task) =>
      c.role === 'leader' || c.role === 'admin' ||
      (t.writerId === c.userId &&
       ['not_started','in_progress'].includes(t.status)),
  'submission.create': (c: Ctx, t: Task) =>
      t.writerId === c.userId && t.status !== 'complete',
  'review.create': (c: Ctx, t: Task) =>
      c.role === 'leader' || c.role === 'admin' || t.editorId === c.userId,
  'message.post':  (c: Ctx, conv: Conversation) =>
      conv.type !== 'all_team' || ['leader','admin'].includes(c.role),
  'channel.create': (c: Ctx) => ['leader','admin'].includes(c.role),
  'user.manage':   (c: Ctx) => c.role === 'admin',
} as const;
```

#### 6.4 Fastify Middleware

```ts
fastify.addHook('preHandler', async (req, reply) => {
  const claims = await verifyJwt(req.headers.authorization);
  req.user = { userId: claims.sub, role: claims.role };
  // Also set DB GUC for RLS:
  await req.db.query(
    `SELECT set_config('app.user_id',$1,true),
            set_config('app.user_role',$2,true)`,
    [req.user.userId, req.user.role]
  );
});

// Per-route guard
fastify.post('/tasks', { preHandler: requirePolicy('task.create') }, handler);
```

#### 6.5 Audit Logging
Every mutating endpoint writes an `audit_log` row in the same DB transaction as the change. Reads are not audited (volume).

#### 6.6 Test Strategy for RBAC
- **Policy unit tests**: 100% matrix coverage — one test per (role × action × resource state).
- **RLS integration tests**: spin up Postgres, set GUCs, attempt forbidden queries, assert empty / error.
- **End-to-end**: Playwright tests run as each role; assert UI surfaces and API responses align.

---

## PHASE 4 — TASK ENGINE

### 7. Task Lifecycle State Machine

A task moves through four canonical states. State changes are driven by **events**, not by free-form column drags by writers.

```
              ┌────────────┐
              │ not_started│ ◀──────── (created by leader/admin)
              └─────┬──────┘
        writer_start│
                    ▼
              ┌────────────┐
              │ in_progress│
              └─────┬──────┘
        writer_submit│
                    ▼
              ┌────────────┐
              │ submitted  │ ◀────── (new submission version
              └─────┬──────┘          while in changes_requested
        editor_decide│           returns to this state)
                    │
        ┌───────────┼─────────────┐
        ▼           ▼             ▼
   approved   changes_requested  rejected
        │           │              │
        ▼           ▼              ▼
   ┌─────────┐  back to       ┌──────────┐
   │complete │  in_progress    │ complete│  (rejected ends task,
   └─────────┘  (writer redoes)└──────────┘  archived not deleted)
```

#### 7.1 Allowed Transitions

| From | To | Event | Actor |
|---|---|---|---|
| `not_started` | `in_progress` | `task.start` | writer (own) / leader / admin |
| `in_progress` | `submitted` | `submission.create` | writer (own) |
| `submitted` | `in_progress` | `review.changes_requested` | editor / leader / admin |
| `submitted` | `complete` | `review.approved` OR `review.rejected` | editor / leader / admin |
| `complete` | `in_progress` | `task.reopen` | leader / admin only |
| any | `not_started` | `task.reset` | admin only |

All other transitions are rejected with `409 invalid_transition`.

#### 7.2 Implementation

State machine is **server-authoritative**. The client never sends `status="complete"`; it sends domain events:

```ts
// apps/api/src/work/state-machine.ts
type Event =
  | { kind: 'task.start' }
  | { kind: 'submission.create', submissionId: string }
  | { kind: 'review.decided', decision: ReviewDecision }
  | { kind: 'task.reopen' }
  | { kind: 'task.reset' };

const transitions: Record<TaskStatus, Partial<Record<Event['kind'], TaskStatus>>> = {
  not_started: { 'task.start': 'in_progress' },
  in_progress: { 'submission.create': 'submitted' },
  submitted:   { 'review.decided': /* computed */ 'in_progress' | 'complete' },
  complete:    { 'task.reopen': 'in_progress', 'task.reset': 'not_started' },
};
```

The transition function is wrapped in a single SQL transaction with the side-effect (insert submission, insert review, etc.) so partial states are impossible.

#### 7.3 Color Computation (green/amber/red)

Recomputed whenever `deadline_at` or `status` changes, and nightly by cron for the time-only transitions.

```
hours_until_deadline = (deadline_at - now()) / interval '1 hour'

color =
  if status = 'complete'                           then 'green'
  if status = 'submitted'                          then 'green'
  if hours_until_deadline < 0                      then 'red'
  if hours_until_deadline <= 24                    then 'red'
  if hours_until_deadline <= 72                    then 'amber'
  if hours_until_deadline <= 24*7                  then 'amber'   -- gentle warn
  else                                                   'green'
```

Stored on the row to avoid recomputing on every kanban read; refreshed by:
1. Triggers on `tasks` UPDATE of `(deadline_at, status)`.
2. Hourly job `recolor_tasks` that updates rows whose color tier just crossed a boundary.

#### 7.4 Events Emitted by State Changes

Each transition emits to the **event bus** (a Postgres `task_events` table consumed by the notifier):

| Transition | Event |
|---|---|
| → `in_progress` (from `not_started`) | `task.started` |
| → `submitted` | `submission.created` |
| → `in_progress` (from `submitted`) | `review.changes_requested` |
| → `complete` | `task.completed` (with decision: approved/rejected) |
| `task.reopen` | `task.reopened` |
| Deadline crossings (job) | `deadline.7d`, `deadline.3d`, `deadline.1d`, `deadline.missed` |

These feed Phase 7 (Notifications).

---

### 8. Kanban Rules + Backend Enforcement

The kanban UI is a **view over `tasks`** grouped by `column_id`. All drag-and-drop interactions translate to either a status transition (system column) or a column reassignment (custom column).

#### 8.1 Visibility Rules

| Role | Visible Cards |
|---|---|
| Writer | `tasks WHERE writer_id = me AND deleted_at IS NULL` |
| Editor | `tasks WHERE editor_id = me AND deleted_at IS NULL` |
| Leader | all non-deleted |
| Admin | all (incl. deleted in admin view) |

Implemented entirely via RLS — the same `GET /boards/:id` endpoint returns different rows per role, with no role-specific code paths in the API handler.

#### 8.2 Drag Rules

| Drag | Writer | Editor | Leader/Admin |
|---|:--:|:--:|:--:|
| `not_started` ↔ `in_progress` (own) | ✅ emits `task.start` (or reverse: admin only) | ❌ | ✅ |
| `in_progress` → `submitted` | ❌ (must use Submit flow) | ❌ | ✅ (admin override emits forced submission record) |
| `submitted` → `complete` | ❌ | ❌ (must use Review flow) | ✅ (admin override) |
| `complete` → anything | ❌ | ❌ | ✅ (`task.reopen`) |
| Reorder within column | ✅ (own) | ✅ (assigned) | ✅ |
| Move to custom column | ❌ | ❌ | ✅ |

A drag from a writer that violates a rule is rejected client-side with a tooltip and server-side with `403`.

#### 8.3 Backend Enforcement (Move Endpoint)

```
POST /tasks/:id/move
body: { columnId: uuid, position: int }
```

Server algorithm:

```
1. Load task + target column (FOR UPDATE on tasks row).
2. Resolve actor role + relationship to task.
3. If target column has status_mapping:
     a. Compute the corresponding state-machine event (e.g., 'task.start').
     b. Call state machine; reject on invalid transition.
     c. Apply side-effects (e.g., status update).
4. Else (custom column):
     a. Require leader/admin.
     b. Update column_id only; do not change status.
5. Update position; resequence siblings (gap-based ordering: positions 1024, 2048, 3072 for cheap inserts).
6. Audit log; emit realtime event.
```

#### 8.4 Custom Columns

- Leaders can add columns with **no** `status_mapping` (purely organizational).
- A custom column may be placed anywhere in `position` order; system columns retain their canonical positions but are reorderable.
- Cards in a custom column retain their underlying `status` (which still drives color, calendar, and notifications).

Add column endpoint:

```
POST /boards/:id/columns
body: { name: string, position: int }
```

Constraint: at most **8** custom columns per board (UX guard, not a hard DB limit).

#### 8.5 Realtime Sync

- Any task mutation publishes via Postgres `LISTEN/NOTIFY` channel `kanban:{board_id}`.
- Supabase Realtime subscribers (web/mobile) receive `task.updated` events containing the patched fields.
- Optimistic UI: client applies move locally; reconciles on server confirmation; reverts with toast on rejection.

#### 8.6 Concurrency
- `SELECT ... FOR UPDATE` on the moved task row prevents lost updates.
- Position resequencing is idempotent: gap-based ordering avoids cascading writes; full renumbering only when gaps shrink below threshold.

---

## PHASE 5 — SUBMISSIONS + REVIEW

### 9. Submission Model

A **submission** is an immutable, versioned snapshot of a writer's deliverable for a task. Every resubmission creates a **new row**; the previous version becomes historical (`is_current=false`).

#### 9.1 Submission Types

| Type | Storage | Use Case |
|---|---|---|
| `file` | Object storage (S3/Supabase Storage); metadata in `attachments` row linked via `owner_kind='submission'` | Uploaded `.docx`, `.pdf`, `.md`, images |
| `google_doc` | URL stored in `submissions.google_doc_url` | External collaborative editing |
| `inline` | Markdown body in `submissions.inline_body` (max 200 KB) | Quick drafts, short content |

#### 9.2 Versioning Rules
- `version` increments per task (1, 2, 3, …).
- Exactly one row per task has `is_current=true` (enforced by partial unique index, §3.4).
- New submission while `submitted` or `in_progress` (post-changes-requested) is allowed; while `complete` is blocked unless `task.reopen` first.
- Versions are **never deleted**, only the current flag flips. Comments and reviews are bound to the *specific* version they were made against.

#### 9.3 Lifecycle

```
1. Writer drafts (client-side; not persisted server-side).
2. POST /tasks/:id/submissions with type + payload.
3. Server:
     a. Authz: writer of task, status ≠ complete.
     b. Pre-trigger: previous current row → is_current=false.
     c. Insert new row; emits state-machine event 'submission.create'.
     d. Task transitions in_progress → submitted.
     e. Audit log; notify editor + leaders.
4. Editor reviews against THIS version.
5. If changes_requested: writer submits a new version (loop).
6. If approved/rejected: task → complete (locked).
```

#### 9.4 File Upload Flow (presigned URL)

```
Client                              API                            Storage
  │                                  │                                │
  │── POST /uploads/sign ──────────▶│                                │
  │   { filename, mime, size }       │                                │
  │                                  │── presign PUT ────────────────▶│
  │                                  │◀── url, storage_key ───────────│
  │◀── url, storage_key, attachId ───│                                │
  │── PUT file ───────────────────────────────────────────────────────▶│
  │── POST /tasks/:id/submissions ─▶│                                │
  │   { type:'file', attachmentId }  │                                │
  │                                  │── verify object exists ───────▶│
  │                                  │── insert submission ───┐       │
```

Constraints:
- Max file size 50 MB (configurable).
- Allowed MIMEs: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/markdown`, `text/plain`, `image/png`, `image/jpeg`.
- Virus scan (ClamAV via lambda or Supabase Edge Function) marks attachment `scan_status` (post-MVP).

#### 9.5 Google Doc Validation
- URL must match `/^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\//`.
- Optionally test reachability (HEAD request) — skipped in MVP because docs may be private.
- We do **not** read content; the link is the artifact.

#### 9.6 Inline Editor (MVP)
- Plain markdown textarea + preview.
- No collaborative editing (no CRDT/OT).
- Stored in `submissions.inline_body`; rendered with `markdown-it` + DOMPurify.

---

### 10. Review + Commenting System

#### 10.1 Review Object
A **review** is a single editor decision on a specific submission version.

```
review = {
  id, submission_id, reviewer_id, decision, summary, created_at
}
```

- A submission may receive multiple reviews (e.g., editor first, leader override). The **latest review** drives task state.
- A `review.decision` of `changes_requested` triggers state machine: task → `in_progress`. Writer must produce a new submission to advance.
- `approved` and `rejected` both move task to `complete`; the `decision` is preserved for reporting.

#### 10.2 Commenting

Comments are scoped to a **submission version** (not the task). When a new version is created, prior comments remain attached to their version and are visible in the version history but not in the active review pane.

| Field | Notes |
|---|---|
| `submission_id` | Required |
| `author_id` | Required |
| `parent_id` | Null = top-level; set = reply (single-level threading in MVP) |
| `body` | Markdown, max 5 KB |
| `anchor` | `null` = general; `{ "kind":"line", "line": 42 }` for inline-on-inline; `{ "kind":"file", "page": 3, "rect":[…] }` for files (post-MVP) |
| `resolved_at` | Set when any participant marks resolved |

#### 10.3 Inline Anchoring per Submission Type

| Type | Anchor Strategy (MVP) |
|---|---|
| `inline` (markdown) | Line number anchor; client highlights line in preview |
| `google_doc` | General comments only in MVP (Google handles inline natively in their UI) |
| `file` | General comments only in MVP; PDF page anchors deferred to V2 |

#### 10.4 Review Flow

```
1. Editor opens task → fetches current submission + all comments.
2. Editor adds inline + general comments (each = POST /comments).
3. Editor submits decision: POST /submissions/:id/reviews
     body: { decision, summary }
4. Server:
     a. Authz: editor assigned OR leader/admin.
     b. Insert review.
     c. Run state machine event 'review.decided'.
     d. If changes_requested: task → in_progress; notify writer.
     e. If approved/rejected: task → complete; notify writer + leader.
5. Realtime push to writer.
```

#### 10.5 Resolve / Reopen Comments
- Either author or any reviewer of the submission can resolve.
- Resolved comments collapse in UI but remain queryable.
- No "reopen" in MVP; create a new comment if the issue resurfaces.

#### 10.6 Mentions
- `@username` syntax in comment body and message body.
- Server parses on insert, records `Notification` rows of kind `comment_added` with `payload.mention=true` for each mentioned user.
- Mentions render as styled tokens; clicking opens the user's profile.

#### 10.7 Edit History
- `comments.updated_at` tracked; UI shows "edited" badge.
- No diff history stored in MVP. Reviews are immutable (no edit endpoint).

#### 10.8 Concurrency
- Multiple editors commenting simultaneously is fine — independent rows.
- A race on submitting a review while a new submission lands is resolved by checking `submission.is_current` at review-insert time; if false, return `409 stale_submission`, prompt editor to refresh.

---

## PHASE 6 — MESSAGING SYSTEM

### 11. Architecture Decision (Build vs Service)

#### 11.1 Options Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Embed third-party (Stream, Sendbird, PubNub)** | Fastest UX; battle-tested | Per-MAU pricing scales poorly later; vendor lock-in for a *core* product surface; can't model permissions identically to ours | ❌ |
| **B. Custom build on Supabase Realtime + Postgres** | Single source of truth (RLS = same auth model as rest of app); zero extra vendor; cheap at 40 users; data co-located for search/notifications | We own the UX work | ✅ **MVP choice** |
| **C. Custom WebSocket service (Socket.IO/uWS)** | Most flexible | Need to operate WS infra, presence, scaling; overkill for 40 users | ❌ |
| **D. Matrix protocol** | Open standard | Operational complexity, learning curve | ❌ |

**Decision:** Option B. Messaging is a first-class part of permissions and notifications; coupling to our Postgres + RLS is a feature, not a bug. Re-evaluate at >500 active users or if we need voice/video.

#### 11.2 What We Build vs Reuse

| Concern | Approach |
|---|---|
| Persistence | Postgres tables (`conversations`, `messages`, `conversation_members`, `message_reads`) |
| Realtime delivery | Supabase Realtime (logical replication → WebSocket) — subscribe to `messages` filtered by RLS |
| Presence (online/typing) | Supabase Presence channel per conversation (in-memory; no DB write) |
| Read receipts | DB rows in `message_reads`, batched on client |
| Push when offline | Notifier service subscribes to `task_events`/`message_events` and dispatches via Expo Push / Web Push |
| Search | Postgres `tsvector` over `messages.body` (GIN index) |
| Attachments | Same `attachments` table + Storage flow as submissions |

---

### 12. Realtime Model

#### 12.1 Channels

| Channel | Subscribers | Source |
|---|---|---|
| `conv:{conversation_id}` | All `conversation_members` of that conversation | `messages` row inserts/updates |
| `presence:conv:{conversation_id}` | Same | Supabase Presence (typing, online) |
| `kanban:{board_id}` | Leaders/admins (full board); writers/editors (their cards) | `tasks` row updates |
| `notif:{user_id}` | Self only | `notifications` row inserts |

All channels are RLS-filtered server-side; clients cannot read messages in a conversation they aren't a member of even if they subscribe.

#### 12.2 Message Send Flow

```
Client                 API                   Postgres                Realtime
  │                      │                      │                      │
  │── POST /messages ───▶│                      │                      │
  │                      │── INSERT message ───▶│                      │
  │                      │                      │── WAL ──────────────▶│
  │◀─ 201 Created ───────│                      │                      │
  │                                              │                      │
  │ ◀──────────────── push to all members on conv:{id} ─────────────────│
```

- Client uses **optimistic insert**: assigns a temporary client_id, shows immediately, reconciles when server echo arrives (matched by client_id).
- API responds < 100 ms; realtime echo arrives < 500 ms (typical Supabase).

#### 12.3 Read Receipts

- On scroll into view, client batches `last_message_id_seen_per_conv` and POSTs every 2 s (debounced).
- Server upserts `conversation_members.last_read_at` and inserts `message_reads` rows for all messages between previous and new pointer (only for non-DM groups; for DMs `last_read_at` is sufficient).
- Other members' clients receive `presence` event "read" — no full message refetch.

#### 12.4 Typing Indicators
- Pure presence channel ephemeral state; never written to DB.
- Client publishes `{ typing: true }` on keypress; auto-expires after 4 s.

#### 12.5 Pinned Announcements
- `messages.pinned_at` set by leader/admin; pinned messages retrieved via `GET /conversations/:id/pinned`.
- Leader-pinned in `all_team` is the "Announcement" surface — pushed as in-app + push notification of kind `announcement_pinned`.

#### 12.6 Conversation Types — Implementation Notes

| Type | Behavior |
|---|---|
| `dm` | Auto-created on first message via `POST /conversations/dm` with `{ otherUserId }`. Idempotent: server finds existing 2-member DM or creates new. |
| `group` | Created by leader/admin; explicit member list. |
| `all_team` | Singleton; every active user auto-added on signup; only leader/admin can post. |
| `issue_channel` | Created by leader for an issue/section; metadata `payload.issue_name` on conversation. |

#### 12.7 Pagination + History
- `GET /conversations/:id/messages?before=<message_id>&limit=50` — keyset pagination on `(created_at, id)`.
- Client virtualizes long histories; loads 50 at a time on scroll-up.

#### 12.8 Search
- `GET /messages/search?q=...&conversationId=...` — Postgres `to_tsvector('simple', body) @@ plainto_tsquery($1)`.
- Results filtered by RLS; only conversations the user is a member of.

#### 12.9 Limits
- Message body max 10 KB.
- Up to 5 attachments per message.
- Per-conversation rate limit: 60 messages/min/user (abuse guard, not normal usage).

#### 12.10 Offline + Reconnection
- Mobile: messages queued in local SQLite (Expo SQLite) when offline; flushed on reconnect.
- On reconnect, client requests `GET /conversations/:id/messages?since=<last_seen_id>` to backfill missed messages, then re-subscribes to realtime.

---

## PHASE 7 — NOTIFICATIONS

### 13. Event System

Notifications are produced by **domain events**, never by handlers directly. This decouples *what happened* from *who gets told*.

#### 13.1 Event Bus (Postgres-based)

A single table acts as the bus. The notifier worker consumes via `LISTEN/NOTIFY`.

```sql
CREATE TABLE domain_events (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  kind        text NOT NULL,                -- e.g., 'task.assigned'
  actor_id    uuid REFERENCES users(id),
  entity      text NOT NULL,
  entity_id   uuid NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX domain_events_unprocessed_idx
  ON domain_events(occurred_at) WHERE processed_at IS NULL;

-- Trigger that fires NOTIFY for each insert
CREATE FUNCTION fire_domain_event() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('domain_events', NEW.id::text);
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_domain_events_notify
  AFTER INSERT ON domain_events
  FOR EACH ROW EXECUTE FUNCTION fire_domain_event();
```

Why a table + LISTEN: durable (no lost events on worker crash) + low-latency (no poll loop).

#### 13.2 Event Catalog

| Event | Producer | Audience Resolver |
|---|---|---|
| `task.assigned` | task create | `[writer, editor?, leader_creator]` |
| `task.reassigned` | task editor/writer change | added user(s) + leader |
| `deadline.7d` | scheduler | writer, editor |
| `deadline.3d` | scheduler | writer, editor |
| `deadline.1d` | scheduler | writer, editor, leader (escalation) |
| `deadline.missed` | scheduler | writer, editor, leader |
| `submission.created` | submission insert | editor, leader |
| `comment.added` | comment insert | submission writer, editor, mentioned users (dedupe self) |
| `review.decided` | review insert | writer (always), leader (on rejected/approved) |
| `task.completed` | state machine → complete | writer, editor, leader |
| `message.received` | message insert | conversation members minus sender |
| `announcement.pinned` | message pin in `all_team` or leader channels | all members of that conversation |

Each event row carries enough payload (`task_id`, `submission_id`, `message_id`, etc.) for the notifier to render summaries without re-fetching.

#### 13.3 Producers
Producers are thin wrappers around state-machine transitions and CRUD endpoints. Every mutation that should notify writes to `domain_events` **in the same transaction** as the mutation. No event = no notification, guaranteed.

#### 13.4 Scheduler (Deadline Events)

A pg-boss cron job runs every 15 minutes:

```sql
-- For each task not complete, compute prior color tier and current.
-- On crossing a tier boundary (or hitting 7d/3d/1d/missed), insert a domain_event
-- IF no existing event of that kind for this task yet (idempotency).
INSERT INTO domain_events (kind, entity, entity_id, payload)
SELECT 'deadline.3d', 'task', t.id,
       jsonb_build_object('writer_id', t.writer_id, 'editor_id', t.editor_id,
                          'deadline_at', t.deadline_at)
FROM tasks t
WHERE t.status NOT IN ('complete')
  AND t.deadline_at BETWEEN now() AND now() + interval '3 days'
  AND t.deadline_at >  now() + interval '1 day'
  AND NOT EXISTS (
    SELECT 1 FROM domain_events de
    WHERE de.entity_id = t.id AND de.kind = 'deadline.3d'
  );
```

Same pattern for `deadline.7d`, `deadline.1d`, `deadline.missed`.

---

### 14. Delivery Logic

#### 14.1 Notifier Worker

Single worker (Node.js, separate process) that:

1. `LISTEN domain_events`.
2. On notify, claim event row (`UPDATE … SET processed_at=now() WHERE processed_at IS NULL RETURNING *` for at-most-once-style claim — combined with retry table for failures).
3. Resolve audience via per-event resolver function.
4. For each recipient: build `Notification` row + dispatch to enabled channels.
5. Mark event `processed_at` on success; push to dead-letter table on repeated failure.

#### 14.2 Channels

| Channel | Transport | When Used |
|---|---|---|
| `in_app` | Postgres `notifications` row → Realtime push to `notif:{user_id}` | Always (default) |
| `push` | Expo Push (mobile), Web Push VAPID (browser) | If user has push tokens AND user not active in app within last 60 s for that surface |
| `email` | Resend / Postmark | Digest only (daily summary at 7am user-tz) + critical events (deadline.missed, task.assigned to brand-new user) |

#### 14.3 Per-User Preferences

```sql
CREATE TABLE notification_prefs (
  user_id  uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- per-kind: array of allowed channels
  prefs    jsonb NOT NULL DEFAULT
    '{"task.assigned":["in_app","push","email"],
      "deadline.7d":["in_app"],
      "deadline.3d":["in_app","push"],
      "deadline.1d":["in_app","push","email"],
      "deadline.missed":["in_app","push","email"],
      "submission.created":["in_app","push"],
      "comment.added":["in_app","push"],
      "review.decided":["in_app","push","email"],
      "task.completed":["in_app"],
      "message.received":["in_app","push"],
      "announcement.pinned":["in_app","push","email"]}'::jsonb,
  quiet_hours_start time,   -- e.g., '22:00'
  quiet_hours_end   time,   -- e.g., '07:00'
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- Quiet hours suppress **push only**; in-app notifications always recorded.
- User-controlled UI in Settings to toggle per-kind channels.

#### 14.4 Dispatcher Pseudocode

```ts
async function dispatch(event: DomainEvent) {
  const recipients = await resolveAudience(event);
  for (const userId of recipients) {
    if (userId === event.actorId) continue;       // never self-notify
    const prefs = await getPrefs(userId);
    const channels = (prefs[event.kind] ?? ['in_app']).filter(c =>
      !inQuietHours(userId, c)
    );

    const notif = await db.insert('notifications', {
      user_id: userId,
      kind: event.kind,
      payload: renderPayload(event),
      channels,
    });

    if (channels.includes('push')) await pushService.send(userId, renderPush(event));
    if (channels.includes('email')) await emailQueue.enqueue(userId, event);
    // in_app is implicit via Realtime on notifications row insert
  }
}
```

#### 14.5 Deduplication + Throttling

- Per (user_id, kind, entity_id) we collapse repeated events within 60 s into a single notification (UPSERT pattern).
- Comment storms: `comment.added` notifications collapse to "X new comments on Y" if 3+ within 5 min for same submission.
- Message notifications collapse per-conversation: at most 1 unread badge bump per minute, but every message still inserts a `notifications` row for the inbox.

#### 14.6 Push Tokens Lifecycle

- On app launch (mobile/web), client registers token: `POST /push-tokens`.
- On 410/Unregistered response from provider, worker deletes that token row.
- Multiple tokens per user (multi-device) supported.

#### 14.7 In-App Inbox

- `GET /notifications?unread=true&limit=50` for the bell icon.
- `POST /notifications/mark-read` with array of ids OR `{ all: true }`.
- Realtime: client subscribes to `notif:{me}`; new rows appear instantly.

#### 14.8 Failure Handling

- Push send failures retried 3× with exponential backoff (1s, 5s, 30s).
- Email failures retried by Resend/Postmark provider; we log and surface in admin.
- A `domain_events_dead_letter` table captures permanently failed events for manual replay by admin.

#### 14.9 Email Digest (Daily)

- pg-boss cron at hourly tick scans `notifications` per-user where any `email` channel notification is pending and user hasn't received a digest in the last 24 h.
- One email per user with grouped sections (deadlines, reviews, mentions, announcements).

---

## PHASE 8 — CALENDAR SYSTEM

### 15. Data Model

The calendar is a **derived view** over `tasks` (deadlines). There is no independent calendar storage in MVP. This avoids drift between the kanban and the calendar.

#### 15.1 Virtual Entity

```ts
interface CalendarEvent {
  id: string;            // = task.id
  taskId: string;
  title: string;         // task.title
  start: timestamptz;    // task.deadline_at (deadline = single point)
  allDay: boolean;       // true if deadline_at time component is 00:00 in user tz
  status: TaskStatus;
  color: 'green' | 'amber' | 'red';
  writerId: string;
  writerName: string;
  editorId?: string;
  editorName?: string;
  isOverdue: boolean;    // computed: deadline_at < now() AND status NOT IN ('complete')
}
```

#### 15.2 Source Query

```sql
CREATE OR REPLACE VIEW calendar_events AS
SELECT
  t.id                           AS id,
  t.id                           AS task_id,
  t.title,
  t.deadline_at                  AS start_at,
  t.deadline_tz,
  t.status,
  t.color,
  t.writer_id,
  uw.name                        AS writer_name,
  t.editor_id,
  ue.name                        AS editor_name,
  (t.deadline_at < now() AND t.status <> 'complete') AS is_overdue
FROM tasks t
JOIN users uw ON uw.id = t.writer_id
LEFT JOIN users ue ON ue.id = t.editor_id
WHERE t.deleted_at IS NULL;
```

RLS on `tasks` propagates to the view automatically — writers see only their rows, leaders see all.

#### 15.3 No Recurring Events
- Tasks are single-deadline. No recurrence in MVP.
- Future (V2): editorial issues with recurring section deadlines could spawn task templates.

#### 15.4 Personal vs Master Calendar

| View | Filter |
|---|---|
| **Writer personal** | `writer_id = me` |
| **Editor personal** | `writer_id = me OR editor_id = me` (their own work + queue) |
| **Leader/Admin master** | all |

These are query-time filters; no separate storage.

#### 15.5 ICS Export (V2 candidate, scoped here)
- `GET /calendar/feed.ics?token=<personal_token>` returns standard iCalendar feed for subscription in Google/Apple/Outlook.
- Personal token stored on `users.ical_token` (uuid, regenerable).
- Read-only feed; updates propagate on next client sync (typical: 1–24 h).

---

### 16. Sync + Filtering Logic

#### 16.1 API Endpoints

```
GET /calendar/events?from=2026-05-01&to=2026-05-31
                     [&writerId=...&editorId=...&status=...&color=...]
```

- `from`/`to` are required (max 90-day window) — passed as ISO date strings interpreted in the requesting user's timezone.
- Server expands the window to UTC bounds for the underlying query.
- Filters apply on top of RLS — a writer cannot use `writerId=other_user` to bypass.

Response shape:

```json
{
  "events": [ /* CalendarEvent */ ],
  "range": { "from": "2026-05-01", "to": "2026-05-31", "tz": "America/Denver" }
}
```

#### 16.2 Filter Catalog (Leader/Admin Master Calendar)

| Filter | Param | Notes |
|---|---|---|
| Writer | `writerId` (multi) | Multi-select |
| Editor | `editorId` (multi) | Multi-select |
| Status | `status` (multi) | Maps to `task_status` |
| Color | `color` (multi) | Maps to `task_color` |
| Overdue only | `overdue=true` | Shortcut: `status<>complete AND deadline<now` |
| Search | `q` | Title contains (ILIKE) |

#### 16.3 Timezone Handling

- Storage: `deadline_at` is `timestamptz` (UTC). `deadline_tz` carries the IANA zone the leader used when setting it (for display tooltips like "deadline: 5pm MT").
- Display: client renders all events in the **viewer's** `users.timezone`, not the deadline_tz. UI shows a small "(set in MT)" annotation when the two differ.
- DST: handled by `timestamptz` arithmetic; we never store wall-clock without zone.

#### 16.4 Realtime Updates

- Calendar view subscribes to `tasks` realtime channel scoped by RLS (same as kanban).
- On `task.updated` event, client patches the in-memory event list; no full refetch.
- Leader's master calendar also subscribes to a dedicated `calendar:master` channel for create/delete events to add/remove items.

#### 16.5 Overdue Highlighting

- Computed client-side from `is_overdue` flag plus a 60-second client clock so events flip to "overdue" without server roundtrip.
- Visual: red border + clock icon on the event chip; same color tier as kanban for consistency.

#### 16.6 Performance

- Default window: current month (~30 days). With 40 users × ~10 active deadlines = ~400 events worst case — fits trivially in a single query.
- Index `tasks(deadline_at) WHERE deleted_at IS NULL` (already specified in §3.3) covers the main range scan.
- No materialized views needed at this scale.

#### 16.7 Empty States + UX Notes (for product handoff)
- Writer empty state: "No deadlines this month — nice."
- Leader empty state with active filters: "No tasks match your filters." with one-click clear.
- Mobile: defaults to agenda view (vertical list); web defaults to month grid with day-click → drawer.

---

## PHASE 9 — API DESIGN

### 17. Endpoint Structure

REST + JSON. URL prefix `/api/v1`. All routes consume/produce `application/json` unless noted.

#### 17.1 Conventions

| Concern | Convention |
|---|---|
| Naming | Plural nouns: `/tasks`, `/conversations` |
| Identifiers | UUID v7 in all paths |
| Pagination | Keyset: `?cursor=<opaque>&limit=<n>` (default 50, max 200) |
| Filtering | Query params, repeated for multi-value (`?status=in_progress&status=submitted`) |
| Errors | RFC 7807 Problem+JSON: `{ "type", "title", "status", "detail", "code" }` |
| Validation | Zod schemas; 422 on input failure with field-level details |
| Idempotency | `Idempotency-Key` header on POST for create endpoints (24 h dedupe) |
| Versioning | URL prefix only (`/v1`); never break v1 |
| Time | ISO-8601 UTC; clients render in local tz |

#### 17.2 Endpoint Map

##### Auth
```
POST   /auth/signin               { email, password }              → { jwt, refresh, user }
POST   /auth/refresh              { refresh }                       → { jwt, refresh }
POST   /auth/signout              -                                 → 204
POST   /auth/magic-link           { email }                         → 202
POST   /auth/accept-invite        { token, password }               → { jwt, refresh, user }
GET    /auth/me                   -                                 → User
```

##### Users
```
GET    /users                                  ?role=&active=
POST   /users                  (admin)         { email, name, role, timezone }
GET    /users/:id
PATCH  /users/:id              (admin or self) { name?, avatarUrl?, timezone? }
PATCH  /users/:id/role         (admin)         { role }
POST   /users/:id/deactivate   (admin)
```

##### Tasks
```
GET    /tasks                  ?writerId=&editorId=&status=&color=&boardId=
POST   /tasks                  (leader|admin)  { title, instructions?, writerId, editorId?, deadlineAt, deadlineTz, boardId?, columnId? }
GET    /tasks/:id
PATCH  /tasks/:id              (leader|admin)  partial
DELETE /tasks/:id              (leader|admin)  soft delete
POST   /tasks/:id/move         { columnId, position }   -- triggers state machine
POST   /tasks/:id/start        writer self → in_progress (alt to drag)
POST   /tasks/:id/reopen       (leader|admin)
```

##### Submissions
```
GET    /tasks/:taskId/submissions                            -- includes all versions
POST   /tasks/:taskId/submissions  (writer of task)          { type, googleDocUrl?, inlineBody?, attachmentId? }
GET    /submissions/:id
GET    /submissions/:id/versions
```

##### Reviews + Comments
```
POST   /submissions/:id/reviews    (editor of task | leader | admin)  { decision, summary? }
GET    /submissions/:id/reviews
GET    /submissions/:id/comments   ?resolved=
POST   /submissions/:id/comments   { body, anchor?, parentId? }
PATCH  /comments/:id               (author)            { body }
POST   /comments/:id/resolve       { resolved: bool }
DELETE /comments/:id               (author or admin or leader-of-task)
```

##### Kanban / Boards
```
GET    /boards
GET    /boards/:id                 -- includes columns + tasks (RLS-filtered)
POST   /boards/:id/columns         (leader|admin)   { name, position }
PATCH  /boards/:id/columns/:colId  (leader|admin)   { name?, position? }
DELETE /boards/:id/columns/:colId  (leader|admin)   -- only if no tasks
```

##### Conversations + Messages
```
GET    /conversations                       ?type=&q=
POST   /conversations/dm                    { otherUserId }                         -- idempotent
POST   /conversations                       (leader|admin) { type, name, memberIds[], issueName? }
GET    /conversations/:id
PATCH  /conversations/:id                   (leader of channel|admin) { name? }
POST   /conversations/:id/members           (leader of channel|admin) { userIds[] }
DELETE /conversations/:id/members/:userId   (leader of channel|admin or self-leave)
GET    /conversations/:id/messages          ?before=&after=&limit=
POST   /conversations/:id/messages          { body?, attachmentIds? }
PATCH  /messages/:id                        (author)         { body }
DELETE /messages/:id                        (author or admin or leader of channel)
POST   /messages/:id/pin                    (leader of channel|admin) { pinned: bool }
GET    /conversations/:id/pinned
POST   /conversations/:id/read              { lastMessageId }
GET    /messages/search                     ?q=&conversationId=
```

##### Attachments / Uploads
```
POST   /uploads/sign               { filename, mime, size, ownerKind }   → { url, storageKey, attachmentId, expiresAt }
GET    /attachments/:id            -- returns metadata + signed download URL
```

##### Notifications
```
GET    /notifications              ?unread=&limit=&cursor=
POST   /notifications/mark-read    { ids?: [...], all?: true }
GET    /notifications/prefs
PATCH  /notifications/prefs        partial
POST   /push-tokens                { platform, token }
DELETE /push-tokens/:id
```

##### Calendar
```
GET    /calendar/events            ?from=&to=&writerId=&editorId=&status=&color=&overdue=&q=
GET    /calendar/feed.ics          ?token=               -- public, token-gated
POST   /calendar/regenerate-token  (self)
```

##### Admin / Audit
```
GET    /admin/audit                (admin)   ?actorId=&entity=&entityId=&from=&to=
GET    /admin/health               (admin)
GET    /admin/stats                (admin)   -- counts, queue depth
```

#### 17.3 Realtime (Subscription) Endpoints

Realtime is via Supabase WebSocket; clients subscribe to channels by name with JWT:

| Channel | Filter |
|---|---|
| `notif:{userId}` | self only |
| `conv:{conversationId}` | members only (RLS) |
| `kanban:{boardId}` | RLS-filtered tasks |
| `presence:conv:{conversationId}` | members only |

#### 17.4 Webhooks (Outbound, V2)
- `task.completed`, `review.decided` → POST to admin-configured URL with HMAC signature.
- Out of MVP scope.

---

### 18. Auth + Security Model

#### 18.1 Authentication

- **Provider:** Supabase Auth.
- **Methods:** email + password, magic link, invitation flow (admin invites; user sets password on first signin).
- **Token shape:** JWT signed by Supabase (`HS256` shared secret, rotated annually).
  - Claims: `sub` (user_id), `email`, `role` (custom claim, populated via Supabase Auth Hook from `users.role`), `exp` (1 h), `iat`, `aud`.
- **Refresh:** Refresh token (30 d, rotating). Stored in httpOnly cookie (web) or secure storage (mobile keychain).
- **Session revocation:** Admin can deactivate a user → next refresh fails; in-flight access tokens expire within 1 h max.

#### 18.2 Authorization Layers

(See §6 for the policy model.)

1. **JWT verification** at Fastify gateway.
2. **Policy check** via `requirePolicy(action)` per route.
3. **Postgres RLS** as defense in depth.
4. **Audit log** records every mutation.

#### 18.3 Transport + Storage Security

| Concern | Control |
|---|---|
| In-transit | TLS 1.2+ everywhere; HSTS on web; certificate pinning on mobile (optional) |
| At-rest | Postgres encryption at rest (managed); object storage SSE-S3 |
| Secrets | `.env` not committed; production secrets in Doppler/Vercel/Fly secrets |
| DB credentials | Per-environment; service role key never shipped to clients |
| Backups | Daily snapshots, 30-day retention; restore drill quarterly |

#### 18.4 Input Validation

- Every endpoint defines a Zod schema for params, query, and body.
- Schemas live in `@journal/contracts` and are reused by clients (typed fetcher).
- Reject unknown fields by default (`strict()`).

#### 18.5 Output Filtering

- Serializers (`@journal/contracts` `userPublic`, `taskPublic`, etc.) explicitly whitelist fields.
- Never spread DB rows directly into responses.

#### 18.6 Rate Limiting

| Surface | Limit |
|---|---|
| `/auth/signin`, `/auth/magic-link` | 10/min/IP |
| `/messages` POST | 60/min/user |
| `/comments` POST | 60/min/user |
| All other writes | 120/min/user |
| Reads | 600/min/user |

Implemented via Fastify rate-limit plugin backed by Redis (single instance) or in-process LRU at this scale.

#### 18.7 CORS

- Web origin allow-list per environment.
- Mobile uses native HTTP (no CORS).
- Credentials included on web (cookie-based refresh).

#### 18.8 CSRF

- Cookie-based refresh token uses `SameSite=Strict` + double-submit token on refresh endpoint.
- API access tokens sent via `Authorization: Bearer` header — no CSRF concern for those endpoints.

#### 18.9 File Upload Security

- Signed PUT URLs are scoped: bucket prefix `submissions/{taskId}/{uuid}/` or `messages/{conversationId}/{uuid}/`.
- Server validates declared mime + size against allow-list before signing.
- Post-upload, server verifies object exists and content-length matches.
- ClamAV scan job (post-MVP) updates `attachments.scan_status`; quarantined files are never served.

#### 18.10 PII + GDPR-Lite

- Minimal PII: name, email, avatar, timezone.
- User export: admin endpoint dumps user's data as JSON.
- User delete: soft-delete user; anonymize comments/messages (`author_name = "deleted user"`); hard-delete after 30-day grace.

#### 18.11 Logging Hygiene

- Never log JWTs, refresh tokens, message bodies, comment bodies, file contents.
- Log request id (`x-request-id`), user id, route, status, latency.
- Sentry scrub list configured for `password`, `token`, `body`.

#### 18.12 Threat Model (top risks at this scale)

| Risk | Mitigation |
|---|---|
| Account takeover via weak passwords | Min length 12, breached-password check via `haveibeenpwned` k-anon API on signup |
| RBAC bypass via direct DB access | RLS enforced unconditionally; no service-role usage from app code paths |
| File enumeration in storage | Random UUID paths; signed read URLs (15-min TTL) |
| Notification spam | Throttling + dedupe (§14.5) |
| Insider abuse by leader/admin | Audit log immutable + admin role assignment requires existing admin |

---

## PHASE 10 — MVP PLAN

### 19. MVP Scope

**MVP Goal:** A team of 40 can create tasks, write/submit/review them, communicate, and not miss deadlines — on web + mobile.

**MVP Definition of Done:** All four roles can complete a full task lifecycle (assign → write → submit → review → complete) end-to-end on both web and mobile, with realtime updates and push notifications.

#### 19.1 IN SCOPE — MVP

**Identity + Roles**
- Email + password login, magic link, admin-invited signup
- Four roles (writer, editor, leader, admin)
- Profile (name, avatar, timezone)
- Admin user management (invite, role change, deactivate)

**Tasks + Kanban**
- Leader/admin creates tasks (title, instructions, writer, optional editor, deadline + tz)
- Four system columns (Not Started, In Progress, Submitted, Complete)
- Custom columns (leader/admin add)
- Drag-and-drop with role-based rules (writer limited to own card between not_started ↔ in_progress)
- Color indicators (green/amber/red) computed and stored
- Server-authoritative state machine

**Submissions**
- Three submission types: file upload, Google Doc URL, inline markdown
- Versioning (one current per task; history retained)
- File presigned upload to object storage

**Review + Comments**
- Editor decisions: approved / changes_requested / rejected
- General comments + line-anchored inline comments on `inline` submissions
- Reply (one level), resolve, edit own
- Mentions (`@user`)

**Messaging**
- 1:1 DMs (auto-created)
- Group chats (leader/admin)
- All-Team channel (singleton; leader/admin posts only)
- Issue/section channels (leader/admin)
- Read receipts (DM + groups)
- File/image attachments (5/message)
- Pinned messages
- Realtime delivery via Supabase Realtime
- Search (Postgres FTS) within conversations user is a member of

**Notifications**
- In-app inbox + bell with unread badge
- Push (iOS, Android, Web Push)
- Triggers: task_assigned, deadline_7d/3d/1d, deadline_missed, submission_created, comment_added (incl. mentions), review_decided, task_completed, message_received, announcement_pinned
- Per-user preferences (per-kind channel toggles, quiet hours)
- Daily email digest

**Calendar**
- Personal calendar (own deadlines)
- Master calendar for leader/admin (filterable: writer, editor, status, color, overdue)
- Overdue highlighting
- Timezone-aware rendering

**Platforms**
- Web (Next.js, responsive)
- iOS + Android (React Native via Expo)
- Shared API contracts (`@journal/contracts`)

**Cross-cutting**
- RBAC enforced at API + RLS
- Audit log for all mutations
- Sentry error tracking
- Daily DB backups

#### 19.2 OUT OF SCOPE — MVP (parked for V2)

- Voice/video calls
- Threaded message replies (Slack-style)
- Reactions / emoji on messages
- Inline comments on file/PDF submissions (only `inline` type supports inline anchoring in MVP)
- Collaborative real-time editing (CRDT/OT)
- Webhooks (outbound)
- Public ICS calendar feed (defer if time-pressed; otherwise small)
- ClamAV virus scanning (file uploads accepted but not scanned in MVP; mitigate via mime allow-list)
- Workspace-level settings beyond defaults
- Multi-workspace / multi-tenant
- Advanced analytics, dashboards, reporting
- SSO (Google/SAML)
- Custom roles beyond the four
- Recurring tasks / templates
- Task dependencies (blocking)
- Time tracking
- Granular per-channel notification prefs (only per-kind in MVP)
- Internationalization (English only)
- Offline-first message composition (mobile basic queue only)

#### 19.3 MVP Acceptance Criteria

| # | Criterion | How verified |
|---|---|---|
| 1 | A leader can invite a writer, assign a task, and the writer receives in-app + push notification within 10 s | Manual + e2e |
| 2 | Writer can submit via all three submission types | e2e per type |
| 3 | Editor receives notification of submission and can approve / request changes / reject; task moves correctly | e2e |
| 4 | Writer cannot view tasks not assigned to them (UI + direct API + direct DB query all blocked) | RLS + policy tests |
| 5 | Leader sees full kanban; writer sees only their own cards | e2e per role |
| 6 | Deadline-7d/3d/1d notifications fire within ±15 min of expected time | Scheduler integration test |
| 7 | All-team announcement reaches every member's push within 30 s | Manual |
| 8 | Master calendar filters work and respect RLS | e2e |
| 9 | All four roles complete full lifecycle on iOS, Android, and Web | Cross-platform smoke test |
| 10 | p95 API latency < 300 ms reads, < 600 ms writes under 40 concurrent users (load-tested with k6) | Load test |

---

### 20. V2 Expansion

Prioritized post-MVP roadmap. Each item is sized as **S/M/L** (S < 1 wk, M = 1–3 wk, L > 3 wk).

#### 20.1 Reviewer + Writer UX

| Item | Size | Why |
|---|---|---|
| Inline comments on file/PDF submissions (PDF.js + page+rect anchors) | L | Closes the biggest review-flow gap |
| Threaded comment replies (multi-level) | S | Power users will want it |
| Comment reactions (👍 ✅) | S | Lightweight signal without resolve |
| Side-by-side diff between submission versions (markdown) | M | Reviewer efficiency |
| Real-time collaborative inline editor (CRDT via Yjs) | L | Replaces "Google Doc" path for many teams |

#### 20.2 Workflow

| Item | Size |
|---|---|
| Recurring tasks / editorial issue templates (e.g., "Monthly issue #42 spawns 12 article tasks") | M |
| Task dependencies (blocked-by / blocks) | M |
| Bulk task ops (CSV import, multi-assign, batch deadline shift) | S |
| Custom workflow states (per-board state machines) | L |
| Time tracking per task | M |

#### 20.3 Messaging

| Item | Size |
|---|---|
| Threaded replies | M |
| Emoji reactions | S |
| Voice/video (1:1 via WebRTC, group via SFU like LiveKit) | L |
| Slack/Teams bridge (read-only mirror) | L |
| Per-conversation notification overrides | S |

#### 20.4 Calendar + Planning

| Item | Size |
|---|---|
| ICS export feed (move into MVP if time allows) | S |
| Two-way Google Calendar sync | M |
| Capacity view (writer workload heatmap) | M |
| Editorial calendar (issue-level Gantt) | L |

#### 20.5 Platform + Operations

| Item | Size |
|---|---|
| SSO (Google Workspace, Microsoft) | M |
| SAML / SCIM provisioning | L |
| Multi-workspace (one user, many teams) | L |
| Granular custom roles + permission editor | L |
| Public REST API + OAuth apps | M |
| Outbound webhooks | S |
| Audit log UI (admin) | S |
| Analytics dashboard (deadlines hit %, avg revisions, throughput) | M |

#### 20.6 Trust + Safety

| Item | Size |
|---|---|
| ClamAV virus scanning (mandatory for files) | S |
| 2FA (TOTP) | S |
| Account export + GDPR delete UI | S |
| Session management (active devices list, force-signout) | S |
| Backup-restore drill automation | M |

#### 20.7 Internationalization

| Item | Size |
|---|---|
| i18n framework (next-intl + Expo localization) | M |
| First non-English locale | S per locale |

#### 20.8 V2 Sequencing Recommendation

1. **Quarter 1 post-MVP:** ClamAV, ICS export, threaded replies, reactions, comment-on-PDF (top user friction).
2. **Quarter 2:** SSO, recurring tasks, audit log UI, capacity view.
3. **Quarter 3:** Collaborative editor, voice/video, multi-workspace.
4. **Quarter 4:** Public API, analytics, custom roles.

---

## PHASE 11 — BUILD ROADMAP

### 21. Phase-by-Phase Execution Plan

**Team assumption:** 1 backend, 1 web, 1 mobile, 0.5 design, 0.5 PM. Fewer engineers → extend each phase ~1.5×. Phases 0–8 = MVP. Total MVP target: **~14 weeks**.

#### Phase 0 — Foundation (Week 1)

**Goal:** Repos exist, deploys work, hello-world reachable on all platforms.

| Task | Owner |
|---|---|
| Monorepo (pnpm workspaces): `apps/api`, `apps/web`, `apps/mobile`, `packages/contracts`, `packages/db` | Backend |
| `@journal/contracts` skeleton with Zod schemas + shared types | Backend |
| Postgres + Supabase project (staging + prod), `.env` baselines, secrets in Doppler | Backend |
| Fastify API skeleton with health check, `/auth/me` stub, JWT verification | Backend |
| Next.js 14 app with auth-gated home page | Web |
| Expo app with auth-gated home screen, EAS configured | Mobile |
| GitHub Actions: lint, typecheck, test, deploy on green to staging (web → Vercel, api → Fly, mobile → EAS branch) | Backend |
| Sentry + log shipping wired in all three apps | Backend |

**Exit criteria:** Each app deploys to staging on merge to `main`. Auth round-trip works on all platforms.

---

#### Phase 1 — Identity + RBAC (Week 2)

**Goal:** Real users with real roles, enforced.

| Task | Owner |
|---|---|
| Migrations: `users`, `push_tokens`, `audit_log`, enums | Backend |
| Supabase Auth integration; custom JWT claim `role` populated from `users.role` | Backend |
| Endpoints: `/auth/*`, `/users` (CRUD), `/users/:id/role`, `/users/:id/deactivate` | Backend |
| RLS policies on `users` (read self + role-gated read all) | Backend |
| Policy module + `requirePolicy` middleware (§6.3, §6.4) | Backend |
| Admin invite flow (email with invite token → set password → first signin) | Backend + Web |
| Web: login, signup-from-invite, profile, admin user list | Web |
| Mobile: login, profile (no admin UI on mobile in MVP) | Mobile |
| RBAC unit tests (matrix coverage); RLS integration tests | Backend |

**Exit criteria:** Admin can invite a user, assign a role, deactivate. RBAC matrix tests green.

---

#### Phase 2 — Tasks + Kanban (Weeks 3–4)

**Goal:** Leader creates tasks, all roles see correctly scoped boards, drag rules enforced.

| Task | Owner |
|---|---|
| Migrations: `kanban_boards`, `kanban_columns`, `tasks`, triggers (color, updated_at, status-column-mapping) | Backend |
| State machine module (§7.2) | Backend |
| Endpoints: `/tasks` CRUD, `/tasks/:id/move`, `/tasks/:id/start`, `/boards/*`, `/boards/:id/columns/*` | Backend |
| RLS policies on tasks (writer/editor/leader visibility) | Backend |
| Color computation trigger + hourly recolor job (pg-boss) | Backend |
| Realtime subscription helper (`kanban:{boardId}`) | Backend |
| Web: kanban board with drag-and-drop (dnd-kit), task drawer, task create modal (leader/admin), filters | Web |
| Mobile: list-of-columns view (horizontal swipe), task detail screen, status change buttons (no drag on mobile MVP) | Mobile |
| e2e: full task lifecycle per role | Backend + QA |

**Exit criteria:** All four roles see the right cards. Writer drag limited to allowed transitions. Leader can add custom columns.

---

#### Phase 3 — Submissions + Review (Weeks 5–6)

**Goal:** Writers submit; editors decide; comments work.

| Task | Owner |
|---|---|
| Migrations: `submissions`, `reviews`, `comments`, `attachments`; triggers (one-current, submitter==writer) | Backend |
| Object storage bucket setup; presigned upload endpoint `/uploads/sign` | Backend |
| Endpoints: submissions CRUD, `/submissions/:id/reviews`, `/submissions/:id/comments`, `/comments/:id/resolve` | Backend |
| Mention parsing + `Notification` writes for `@user` | Backend |
| State-machine wiring: review.decided → task transition | Backend |
| RLS policies on submissions/reviews/comments | Backend |
| Web: submission UI (file upload, Google Doc URL, inline markdown), review pane with inline + general comments, mention autocomplete | Web |
| Mobile: submission UI (file pick, URL paste, inline markdown), review actions (read + decide); inline anchors view-only on mobile | Mobile |
| e2e: full review cycle including resubmission after changes_requested | Backend + QA |

**Exit criteria:** Writer can submit all three types. Editor can decide. Comments persist correctly per version.

---

#### Phase 4 — Messaging (Weeks 7–8)

**Goal:** Realtime chat across DMs, groups, all-team, and channels.

| Task | Owner |
|---|---|
| Migrations: `conversations`, `conversation_members`, `messages`, `message_reads`; singleton constraint for `all_team` | Backend |
| Endpoints: conversations CRUD, members add/remove, messages CRUD, pin, read, search | Backend |
| Idempotent DM creation logic | Backend |
| Bootstrap: every active user auto-joined to `all_team` (and on signup) | Backend |
| RLS policies on conversations/messages/reads | Backend |
| Realtime channel + presence wiring | Backend |
| Postgres FTS index on `messages.body` | Backend |
| Web: conversation list, chat view (virtualized), composer with attachments, pin UI, search | Web |
| Mobile: conversation list, chat view, composer, push-to-foreground deep-link to message | Mobile |
| Read receipt batching (debounced) on both clients | Web + Mobile |

**Exit criteria:** Two devices exchange messages in < 1 s. Pinned announcements visible. Search returns scoped results.

---

#### Phase 5 — Notifications (Week 9)

**Goal:** All event types fire via in-app + push, with per-user prefs.

| Task | Owner |
|---|---|
| Migrations: `domain_events`, `notifications`, `notification_prefs`; trigger fire_domain_event | Backend |
| Notifier worker (separate process); audience resolvers per event kind | Backend |
| pg-boss cron: deadline scanners (7d/3d/1d/missed); idempotency guards | Backend |
| Push providers: Expo Push (mobile), VAPID Web Push (web); token registration endpoints | Backend |
| Email digest job (daily, per-user TZ-aware) via Resend/Postmark | Backend |
| Throttle/dedupe layer (§14.5) | Backend |
| Web: bell + inbox, notification preferences screen, browser push permission flow | Web |
| Mobile: in-app inbox, settings screen, native push permission, deep-links from push | Mobile |
| Integration tests for each event kind end-to-end (event → notification row → push call) | Backend |

**Exit criteria:** Every event in catalog (§13.2) produces correct notifications and reaches all enabled channels.

---

#### Phase 6 — Calendar (Week 10)

**Goal:** Personal + master calendars working with filters and overdue highlighting.

| Task | Owner |
|---|---|
| `calendar_events` view (§15.2) | Backend |
| Endpoint: `/calendar/events` with date window + filters | Backend |
| Realtime patch on task updates (already from Phase 2) | Backend |
| Web: month + week views, agenda view, leader filter sidebar | Web |
| Mobile: agenda view (default), filter sheet for leader/admin | Mobile |
| Timezone handling (renders in viewer's tz; tooltip shows deadline_tz) | Web + Mobile |

**Exit criteria:** Writer sees own deadlines; leader sees all with filter combinations. Overdue items visually distinct.

---

#### Phase 7 — Hardening (Week 11)

**Goal:** Production-ready quality bar.

| Task | Owner |
|---|---|
| Rate limiting (Fastify rate-limit plugin) | Backend |
| Audit log emission verified on every mutation | Backend |
| Backups verified; restore drill executed in staging | Backend |
| Sentry alerts wired (errors, slow endpoints) | Backend |
| Load test (k6, simulate 40 concurrent users + realtime) | Backend |
| Security review: RLS policy review, secret leak scan, dependency audit | Backend |
| Accessibility pass (web: keyboard nav, color contrast; mobile: screen-reader labels) | Web + Mobile |
| Empty states + error states for all screens | Web + Mobile + Design |
| Onboarding flow + admin runbook | PM |

**Exit criteria:** Performance targets met (§1.6). Security review signed off. Accessibility AA on critical paths.

---

#### Phase 8 — UAT + Launch (Weeks 12–14)

**Goal:** Real team uses it; ship.

| Week | Focus |
|---|---|
| 12 | Closed beta with 5 internal users; daily triage; bugfix sprint |
| 13 | Open to all 40 users; UAT scenarios; data migration from prior tools (CSV import script if needed) |
| 14 | Launch checklist (DNS, monitoring, support runbook, rollback plan); GA |

**Launch checklist:**
- [ ] Production secrets rotated from staging
- [ ] DNS + TLS certs verified
- [ ] Monitoring alerts paged to on-call
- [ ] DB backup verified (most recent restore tested)
- [ ] Rollback documented (revert deploy + DB migration down)
- [ ] Support inbox + escalation defined
- [ ] iOS App Store + Google Play submissions approved

---

#### Cross-Phase Tracks

| Track | Cadence |
|---|---|
| Design | One sprint ahead of engineering on each phase |
| QA / e2e | New Playwright + Detox tests added each phase; suite runs on every PR |
| Documentation | Endpoint docs auto-generated from Zod schemas; user docs written in parallel |
| Security review | Quick review at end of each phase; full review in Phase 7 |

---

#### Risk Register

| Risk | Phase | Mitigation |
|---|---|---|
| Supabase Realtime hits limits unexpectedly | 2, 4 | Load test in Phase 7; have plan B (custom WS service) sketched |
| Push notification delivery delays on Android | 5 | Test with real devices early; use Expo Push (FCM under the hood) |
| RLS policies become hard to reason about | 2, 3, 4 | Mandatory policy tests per table; policy-only PRs reviewed by 2 engineers |
| Mobile keyboard / autosave edge cases in inline editor | 3 | Allocate buffer time in Phase 3; consider read-mostly mobile editor |
| Scope creep from "we should also have..." | All | This document is the contract; V2 list captures deferred items |
| Single backend engineer bottleneck | All | Frontend engineers contribute API endpoints in their feature scope; backend reviews |

---

#### Dependencies (Critical Path)

```
Phase 0 → Phase 1 → Phase 2 ─┬─▶ Phase 3 ─┐
                              │              ├─▶ Phase 5 ─▶ Phase 6 ─▶ Phase 7 ─▶ Phase 8
                              └─▶ Phase 4 ─┘
```

Phases 3 and 4 can run in parallel if mobile bandwidth allows (mobile usually serializes them).

---

### Document Status

This is the master plan. Every section references concrete schemas, endpoints, or policies. Engineering can begin Phase 0 immediately. Product can prioritize V2 items against the same shared vocabulary.

**Open items requiring product input before Phase 1:**
- Confirm role names match team's mental model (writer/editor/leader/admin).
- Confirm "all-team" channel is mandatory (vs opt-in).
- Confirm file size + mime allow-list are acceptable.
- Confirm email digest time (default 7 AM user-tz).

These are the only product decisions still pending; defaults are specified above and are safe to ship if no input is given.

---

*End of master plan.*












