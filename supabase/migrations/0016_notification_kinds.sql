-- ─────────────────────────────────────────────────────────────────────────────
-- 0016 — new notification kinds for feedback + competitions
--
-- `ALTER TYPE ... ADD VALUE` must be committed before the new value can be used
-- at runtime, so the enum additions live in their own migration ahead of the
-- feedback (0018) and competition (0019) feature migrations. Idempotent via
-- `IF NOT EXISTS` so re-running the migration set is safe.
-- ─────────────────────────────────────────────────────────────────────────────

alter type notification_kind add value if not exists 'feedback';
alter type notification_kind add value if not exists 'competition';
