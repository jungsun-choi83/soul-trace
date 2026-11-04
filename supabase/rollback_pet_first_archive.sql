-- Staging rollback for migration_pet_first_archive.sql.
-- Drops only the pet-first objects and the columns that migration added.
-- Does not drop soul_trace_pets, soul_trace_submissions, or life_archive_* data.
-- Do not run this on production unless the pet-first rows have been exported
-- and the operator has approved the data loss of those new rows and columns.

drop policy if exists "Owners can manage their pet timeline assets" on public.pet_timeline_assets;
drop policy if exists "Owners can manage their pet timeline entries" on public.pet_timeline_entries;
drop table if exists public.pet_timeline_assets;
drop table if exists public.pet_timeline_entries;

drop policy if exists "Owners can create their pets" on public.soul_trace_pets;
drop policy if exists "Owners can update their pets" on public.soul_trace_pets;

drop function if exists public.ensure_soul_trace_owner();

alter table public.soul_trace_pets drop constraint if exists soul_trace_pets_life_status_check;
alter table public.soul_trace_pets
  drop column if exists life_status,
  drop column if exists species,
  drop column if exists birthday,
  drop column if exists adopted_on,
  drop column if exists traits,
  drop column if exists updated_at;
