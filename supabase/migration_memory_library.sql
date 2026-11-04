-- Memory library, memorial space, mood journal, and Beam scene drafts.
-- Additive. Do not run against production without explicit approval.
-- Existing soul_trace_submissions, life_archive_*, and pet_timeline_* rows stay in place.

alter table public.pet_timeline_entries
  add column if not exists place text,
  add column if not exists favorite boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pet_timeline_entries_place_check'
  ) then
    alter table public.pet_timeline_entries
      add constraint pet_timeline_entries_place_check
      check (place is null or char_length(btrim(place)) between 1 and 80);
  end if;
end $$;

create table if not exists public.pet_mood_journal (
  entry_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  visibility text not null default 'private' check (visibility = 'private'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pet_mood_journal_pet_idx
  on public.pet_mood_journal (owner_user_id, pet_id, created_at desc);

create table if not exists public.beam_scene_previews (
  scene_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete cascade,
  title text,
  happened_on date,
  place_kind text not null default 'home' check (place_kind in ('home', 'park', 'travel', 'other')),
  original_asset_id uuid,
  derivative_asset_id uuid,
  dual_display jsonb not null default '{"left":{"role":"background"},"right":{"role":"foreground"},"hardwarePlayback":false,"transferEnabled":false}'::jsonb,
  playback_ready boolean not null default false,
  created_at timestamptz not null default now(),
  constraint beam_scene_previews_assets_distinct check (
    derivative_asset_id is null or original_asset_id is null or derivative_asset_id <> original_asset_id
  )
);

create index if not exists beam_scene_previews_pet_idx
  on public.beam_scene_previews (owner_user_id, pet_id, created_at desc);

alter table public.pet_mood_journal enable row level security;
alter table public.beam_scene_previews enable row level security;

drop policy if exists "Owners can manage private mood journal" on public.pet_mood_journal;
create policy "Owners can manage private mood journal"
on public.pet_mood_journal for all to authenticated
using (
  owner_user_id = auth.uid()
  and visibility = 'private'
  and exists (
    select 1 from public.soul_trace_pets pets
    where pets.pet_id = pet_mood_journal.pet_id
      and pets.owner_user_id = auth.uid()
      and pets.life_status = 'memorial'
  )
)
with check (
  owner_user_id = auth.uid()
  and visibility = 'private'
  and exists (
    select 1 from public.soul_trace_pets pets
    where pets.pet_id = pet_mood_journal.pet_id
      and pets.owner_user_id = auth.uid()
      and pets.life_status = 'memorial'
  )
);

drop policy if exists "Owners can manage beam scene previews" on public.beam_scene_previews;
create policy "Owners can manage beam scene previews"
on public.beam_scene_previews for all to authenticated
using (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.soul_trace_pets pets
    where pets.pet_id = beam_scene_previews.pet_id
      and pets.owner_user_id = auth.uid()
  )
)
with check (
  owner_user_id = auth.uid()
  and playback_ready = false
  and exists (
    select 1 from public.soul_trace_pets pets
    where pets.pet_id = beam_scene_previews.pet_id
      and pets.owner_user_id = auth.uid()
  )
);

revoke all on table public.pet_mood_journal from public, anon;
revoke all on table public.beam_scene_previews from public, anon;
grant select, insert, delete on table public.pet_mood_journal to authenticated;
grant select, insert, delete on table public.beam_scene_previews to authenticated;

comment on table public.pet_mood_journal is
  'Private guardian notes for memorial-status pets only. Public links, family sharing, and alerts stay off.';
comment on table public.beam_scene_previews is
  'Eternal Beam scene composition drafts. Originals stay in pet_timeline_assets. No hardware playback.';
comment on column public.pet_timeline_entries.place is
  'Optional owner-entered place. Never inferred from GPS.';
comment on column public.pet_timeline_entries.favorite is
  'Owner favorite flag for monthly library grouping.';
