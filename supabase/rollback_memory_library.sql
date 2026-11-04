-- Staging rollback for migration_memory_library.sql.
-- Does not drop soul_trace_pets, soul_trace_submissions, life_archive_*,
-- or pet_timeline_entries/assets. Do not run on production without approval.

drop policy if exists "Owners can manage beam scene previews" on public.beam_scene_previews;
drop policy if exists "Owners can manage private mood journal" on public.pet_mood_journal;
drop table if exists public.beam_scene_previews;
drop table if exists public.pet_mood_journal;

alter table public.pet_timeline_entries drop constraint if exists pet_timeline_entries_place_check;
alter table public.pet_timeline_entries
  drop column if exists place,
  drop column if exists favorite;
