# Frontend UI Architecture

This document describes the production frontend MVP for the Advantage
Portal. It is meant to be read once at handoff and again any time someone
needs to understand where to add a feature or wire a backend endpoint.

The master plan (`docs/journal-platform-master-plan.md`) is the source of
truth for product scope. This document is the source of truth for HOW the
frontend implements that scope.

---

## 1. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 15 App Router | All routes are static / client-rendered today |
| Language | TypeScript strict | `npx tsc --noEmit` passes clean |
| Styling | Tailwind v3 + custom tokens | `#fafaf9` bg, white cards, purple gradient accents |
| Animation | framer-motion | Scoped to kanban + drawer transitions |
| State | React context + in-memory store | No external state lib (no Zustand/Redux) |
| Validation | Zod | `lib/contracts/` defines runtime schemas |

## 2. Route map

Routes live in `app/`:

- `/` — redirects to `/dashboard` if authenticated, otherwise `/login`
- `/login` — demo session entry screen (`app/login/page.tsx`)
- `(app)/...` — authenticated shell. Group layout wraps every child in
  `<AuthGate />` so unauthenticated traffic is bounced to `/login`.
  - `/dashboard` — role-aware overview
  - `/board` — kanban (drag rules per role)
  - `/calendar` — month + agenda views
  - `/messages` — DM/group/issue/all-team conversations (mobile-aware)
  - `/notifications` — bell inbox + Deadline Reminder Simulator
  - `/notifications/preferences` — per-kind toggles
  - `/announcements` — leader/admin posts pinned across the team
  - `/team` — roster (read-only for non-admins)
  - `/admin` — admin-only role + activation controls

## 3. Component tree

```
components/
├── shell/                # app chrome
│   ├── auth-gate.tsx        # session guard — added in CP18
│   ├── sidebar.tsx
│   ├── topbar.tsx
│   ├── role-switcher.tsx    # demo user picker + sign out
│   ├── mobile-tabbar.tsx
│   └── nav-config.ts
├── dashboard/            # stat cards
├── kanban/               # board + cards (drag/drop)
├── task/                 # drawer, forms, viewers, comments, reviews
│   ├── task-drawer.tsx
│   ├── task-form-dialog.tsx
│   ├── task-row.tsx
│   ├── submission-form.tsx
│   ├── submission-history.tsx
│   ├── submission-viewer.tsx
│   ├── inline-markdown-viewer.tsx   # CP13: line-anchored comments
│   ├── comments-panel.tsx
│   └── review-panel.tsx
├── messages/             # conversation list + chat view
├── notifications/        # popover, item, preferences, deadline-scan-control
├── calendar/             # month/agenda + filter bar
├── team/                 # user-list (admin actions inline when authorized)
└── ui/                   # design-system primitives
    ├── button.tsx, badge.tsx, card.tsx, dialog.tsx, dropdown-menu.tsx,
    │   input.tsx, label.tsx, popover.tsx, select.tsx, separator.tsx,
    │   switch.tsx, tabs.tsx, textarea.tsx, avatar.tsx
    └── states.tsx          # EmptyState / AccessDenied / Skeleton helpers
```

## 4. Data + state architecture

There are FIVE layers, in order of distance from the UI:

```
        ┌─────────────────────────────────────┐
UI ───▶ │ data hooks (lib/hooks/)             │
        ├─────────────────────────────────────┤
        │ ApiClient (lib/api/client.ts)       │
        ├──────────────────┬──────────────────┤
        │ MockAdapter      │ HttpAdapter      │
        │ mock-adapter.tsx │ http-adapter.ts  │
        ├──────────────────┴──────────────────┤
        │ StoreProvider (lib/store.tsx)       │   in-memory React state
        ├─────────────────────────────────────┤
        │ mock-data.ts seed                   │
        └─────────────────────────────────────┘
```

- **`StoreProvider`** keeps every entity in React state. Mutations
  (`createTask`, `submitReview`, `addComment`, `runDeadlineScan`, …) live
  here and trigger downstream re-renders.
- **`MockAdapter`** (`lib/api/mock-adapter.tsx`) wraps the store in the
  typed `ApiClient` interface. It is what the data hooks talk to today.
- **`HttpAdapter`** (`lib/api/http-adapter.ts`) is a stub that throws
  `ApiError("Not implemented", 501)` until the real backend exists.
- **Data hooks** (`lib/hooks/index.ts`) expose `useTasks`, `useTask`,
  `useSubmissions`, `useReviews`, `useComments`, `useConversations`,
  `useMessages`, `useNotifications`, `useUsers`, `useVisibleTasks`,
  `useCalendarEvents`. Each returns `{ data, loading, error, refetch }`.
- **UI components** (Dashboard, Calendar, Notifications today; everything
  else over time) consume hooks instead of touching the store directly.

### Session

- `SessionProvider` (`lib/session.tsx`) owns `{ currentUser, role,
  isAuthenticated, isReady, signInAsDemoUser, signOut }`.
- `RoleProvider` is now a thin compatibility shim — `useRole()` still works
  for existing UI, but every new component should call `useSession()`.
- Session is persisted in `localStorage` under
  `advantage-portal:session` (`{ userId, signedIn }`).
- `AuthGate` redirects to `/login?next=…` when the session is empty.

## 5. Permission model

Defined in `lib/permissions.ts`. Role matrix:

| Capability | Writer | Editor | Leader | Admin |
| --- | --- | --- | --- | --- |
| Create / edit task | – | – | ✅ | ✅ |
| Submit work | ✅ on own tasks | – | – | – |
| Review submission | – | ✅ if assigned | ✅ | ✅ |
| Comment on submission | ✅ on own tasks | ✅ if assigned | ✅ | ✅ |
| Drag in kanban | own task between Not Started ↔ In Progress | – | any non-terminal transition | any |
| Post in `all_team` | – | – | ✅ | ✅ |
| Create group / issue conversation | – | – | ✅ | ✅ |
| Pin message / post announcement | – | – | ✅ | ✅ |
| Manage users (role / activate) | – | – | – | ✅ |

Permissions are pure functions — they take the actor and the resource and
return a boolean. They are also re-implemented at the component level via
the `AccessDenied` card to keep UX honest if a user navigates by URL.

## 6. Visual system invariants

- Background `#fafaf9` (`bg-background`).
- Cards default to white surfaces with `shadow-soft`.
- Primary CTAs use the purple gradient `Button variant="gradient"`.
- Rounded corners: `rounded-md` (small) / `rounded-lg` (cards, drawers).
- Body text uses `text-foreground`; secondary uses `text-muted-foreground`.
- Status tones (`bg-emerald-*` / `bg-amber-*` / `bg-red-*`) are reserved for
  task colors and review decisions — don't use them for chrome.

## 7. Mock-only limitations

These are intentional gaps in the MVP. None of them are bugs.

- **No backend.** Refresh resets state to seed.
- **No realtime sync** between tabs / devices.
- **File submissions** never leave the browser; download/open are alerted.
- **Google Doc previews** are placeholders. No iframe, no fetch.
- **Inline markdown** renders as plain text + line numbers. No actual
  Markdown formatting.
- **Search bar** is decorative.
- **Mentions / typing indicators / read receipts** are not implemented.
- **Deadline scan** is a manual demo control, not a scheduler.
- **Audit logs** are absent.

A more detailed checklist lives in `docs/mvp-ui-qa-checklist.md`.

## 8. API transition plan

The frontend is one swap away from a real backend:

1. Implement the real endpoints to match `lib/contracts` schemas.
2. Fill in `HttpApiClient` methods using the `request<T>(path, init, schema)`
   helper already wired into `lib/api/http-adapter.ts`.
3. In `lib/api/provider.tsx`, swap the default mode from `"mock"` to
   `"http"` and provide an `HttpApiClient` instance.
4. Replace the `useMockApiClient(currentUser?.id ?? null)` line with the
   HTTP client. The data hooks, UI components, and contracts stay the same.
5. Replace the in-memory `SessionProvider` body with calls to the real
   auth provider (Supabase recommended — see
   `docs/supabase-setup-guide.md`). The shape of `useSession()` remains.

If steps 1–5 land cleanly, no UI component file needs to be edited.

See `docs/backend-integration-roadmap.md` for the recommended order.
