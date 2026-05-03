-- ─────────────────────────────────────────────────────────────────────────────
-- Advantage Journal Portal — RLS policies for newsroom workflow tables.
--
-- These policies layer on top of the schema added in 0002_newsroom_workflow.sql.
-- They are intentionally conservative: unauthenticated requests return zero
-- rows on every table; authenticated reads are limited to the people who
-- need them; writes for newsroom-shaping actions (issue planning, sensitive
-- decisions) are restricted to leaders and admins.
--
-- These policies depend on:
--   * `auth.uid()`        — Supabase JWT subject (matches public.users.id)
--   * `public.current_app_role()` — defined in 0001_init.sql; reads the JWT
--                                   `app_role` claim or falls back to
--                                   public.users.role.
--
-- Because Supabase Auth wiring is still pending in this portal phase, these
-- policies are written assuming the eventual auth model. Local mock-mode is
-- unaffected — it never touches the database.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── sections ─────────────────────────────────────────────────────────────
-- Sections are reference data. Any authenticated user can read them. Only
-- leaders/admins can edit (so reorganising the newsroom is a privileged op).
drop policy if exists sections_select on public.sections;
create policy sections_select on public.sections
  for select using (auth.role() = 'authenticated');

drop policy if exists sections_write on public.sections;
create policy sections_write on public.sections
  for all using (public.current_app_role() in ('leader','admin'))
       with check (public.current_app_role() in ('leader','admin'));

-- ── issues ───────────────────────────────────────────────────────────────
-- Issues drive the publication schedule. Read by any authenticated user
-- so writers can see the upcoming editions; write/publish gated to
-- leaders/admins.
drop policy if exists issues_select on public.issues;
create policy issues_select on public.issues
  for select using (auth.role() = 'authenticated');

drop policy if exists issues_write on public.issues;
create policy issues_write on public.issues
  for all using (public.current_app_role() in ('leader','admin'))
       with check (public.current_app_role() in ('leader','admin'));

-- ── issue_slots ──────────────────────────────────────────────────────────
-- Slots are visible to anyone who can see the underlying task; this avoids
-- a writer thinking they have an assignment and not seeing where it runs.
-- Slot writes are gated to leaders/admins (issue planning surface).
drop policy if exists issue_slots_select on public.issue_slots;
create policy issue_slots_select on public.issue_slots
  for select using (
    public.current_app_role() in ('leader','admin')
    or exists (
      select 1 from public.tasks t
      where t.id = issue_slots.task_id
        and (
          t.writer_id     = auth.uid()
          or t.editor_id      = auth.uid()
          or t.copy_editor_id = auth.uid()
          or t.fact_checker_id= auth.uid()
        )
    )
  );

drop policy if exists issue_slots_write on public.issue_slots;
create policy issue_slots_write on public.issue_slots
  for all using (public.current_app_role() in ('leader','admin'))
       with check (public.current_app_role() in ('leader','admin'));

-- ── pitches ──────────────────────────────────────────────────────────────
-- Writers see their own pitches. Editors/leaders/admins see every pitch
-- so they can run the queue. Inserts are restricted to the authenticated
-- writer themselves (so users can't pitch on someone else's behalf).
-- Status changes (accept/decline/convert) are restricted to editor and up.
drop policy if exists pitches_select on public.pitches;
create policy pitches_select on public.pitches
  for select using (
    writer_id = auth.uid()
    or public.current_app_role() in ('editor','leader','admin')
  );

drop policy if exists pitches_insert_own on public.pitches;
create policy pitches_insert_own on public.pitches
  for insert with check (writer_id = auth.uid());

drop policy if exists pitches_update_editorial on public.pitches;
create policy pitches_update_editorial on public.pitches
  for update using (
    public.current_app_role() in ('editor','leader','admin')
  ) with check (
    public.current_app_role() in ('editor','leader','admin')
  );

-- Conservative: only leaders/admins delete pitches (audit-friendly).
drop policy if exists pitches_delete_admin on public.pitches;
create policy pitches_delete_admin on public.pitches
  for delete using (public.current_app_role() in ('leader','admin'));

-- ── editorial_checklists ─────────────────────────────────────────────────
-- Read by anyone who can see the parent task (writer, editor, copy desk,
-- fact desk, leader, admin). Writes are restricted to editor and up,
-- matching the UI gating in components/task/editorial-checklist.tsx.
drop policy if exists editorial_checklists_select on public.editorial_checklists;
create policy editorial_checklists_select on public.editorial_checklists
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = editorial_checklists.task_id
        and (
          t.writer_id      = auth.uid()
          or t.editor_id       = auth.uid()
          or t.copy_editor_id  = auth.uid()
          or t.fact_checker_id = auth.uid()
          or public.current_app_role() in ('leader','admin')
        )
    )
  );

drop policy if exists editorial_checklists_write on public.editorial_checklists;
create policy editorial_checklists_write on public.editorial_checklists
  for all using (
    public.current_app_role() in ('editor','leader','admin')
  ) with check (
    public.current_app_role() in ('editor','leader','admin')
  );

-- ── sensitive_flags ──────────────────────────────────────────────────────
-- Anyone with task access can see active flags so they're not surprised by
-- a publication block. Inserts are open to anyone with task access (the
-- "raise low" rule in the master plan). Decisions (clear/hold) are
-- restricted to leaders/admins, matching the editorial-escalation UI.
drop policy if exists sensitive_flags_select on public.sensitive_flags;
create policy sensitive_flags_select on public.sensitive_flags
  for select using (
    public.current_app_role() in ('leader','admin')
    or exists (
      select 1 from public.tasks t
      where t.id = sensitive_flags.task_id
        and (
          t.writer_id      = auth.uid()
          or t.editor_id       = auth.uid()
          or t.copy_editor_id  = auth.uid()
          or t.fact_checker_id = auth.uid()
        )
    )
  );

drop policy if exists sensitive_flags_insert on public.sensitive_flags;
create policy sensitive_flags_insert on public.sensitive_flags
  for insert with check (
    raised_by_id = auth.uid()
    and (
      public.current_app_role() in ('editor','leader','admin')
      or exists (
        select 1 from public.tasks t
        where t.id = sensitive_flags.task_id
          and (
            t.writer_id      = auth.uid()
            or t.editor_id       = auth.uid()
            or t.copy_editor_id  = auth.uid()
            or t.fact_checker_id = auth.uid()
          )
      )
    )
  );

-- Decisions (status changes to cleared/holding) are leader/admin only.
drop policy if exists sensitive_flags_decide on public.sensitive_flags;
create policy sensitive_flags_decide on public.sensitive_flags
  for update using (public.current_app_role() in ('leader','admin'))
              with check (public.current_app_role() in ('leader','admin'));

-- ── tasks: keep existing policies; nothing to alter here ──────────────────
-- The 0001 policy `tasks_select` already covers writer/editor/leader+admin
-- visibility. New columns (section_id, copy_editor_id, fact_checker_id, …)
-- are visible whenever the row is visible, which matches the master plan.
