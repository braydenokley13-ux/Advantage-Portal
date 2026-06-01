-- Allow pitches to be submitted without a section assignment.
alter table public.pitches alter column section_id drop not null;
