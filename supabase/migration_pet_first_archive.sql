-- Pet-first archive. Additive and not applied to production by this file's presence.
-- Existing soul_trace_submissions and life_archive_* rows stay in place.
-- submission_id remains required on the legacy archive tables.
-- Do not run supabase/rollback_pet_first_archive.sql against production data.

alter table public.soul_trace_pets
  add column if not exists life_status text not null default 'unspecified',
  add column if not exists species text,
  add column if not exists birthday date,
  add column if not exists adopted_on date,
  add column if not exists traits text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'soul_trace_pets_life_status_check'
  ) then
    alter table public.soul_trace_pets
      add constraint soul_trace_pets_life_status_check
      check (life_status in ('living', 'memorial', 'unspecified'));
  end if;
end $$;

create or replace function public.ensure_soul_trace_owner()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  insert into public.soul_trace_owners (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.ensure_soul_trace_owner() from public, anon;
grant execute on function public.ensure_soul_trace_owner() to authenticated;

drop policy if exists "Owners can create their pets" on public.soul_trace_pets;
create policy "Owners can create their pets"
on public.soul_trace_pets for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.soul_trace_owners owners
    where owners.user_id = auth.uid()
  )
);

drop policy if exists "Owners can update their pets" on public.soul_trace_pets;
create policy "Owners can update their pets"
on public.soul_trace_pets for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

grant insert, update on table public.soul_trace_pets to authenticated;

create table if not exists public.pet_timeline_entries (
  entry_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete cascade,
  kind text not null check (kind in ('photo', 'video', 'text')),
  title text,
  story text,
  happened_on date,
  visibility text not null default 'private' check (visibility = 'private'),
  origin text not null default 'pet_first_archive' check (origin = 'pet_first_archive'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_timeline_entries_text_story check (
    kind <> 'text' or (story is not null and char_length(btrim(story)) > 0)
  )
);

create table if not exists public.pet_timeline_assets (
  asset_id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.pet_timeline_entries (entry_id) on delete cascade,
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete cascade,
  storage_bucket text not null check (storage_bucket in ('life-archive-photos', 'life-archive-videos')),
  storage_path text not null unique,
  content_type text not null check (content_type in (
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime'
  )),
  byte_size bigint not null check (byte_size > 0),
  asset_order integer not null check (asset_order between 0 and 4),
  created_at timestamptz not null default now(),
  unique (entry_id, asset_order)
);

create index if not exists pet_timeline_entries_pet_idx
  on public.pet_timeline_entries (owner_user_id, pet_id, created_at desc);
create index if not exists pet_timeline_assets_entry_idx
  on public.pet_timeline_assets (entry_id, asset_order);

alter table public.pet_timeline_entries enable row level security;
alter table public.pet_timeline_assets enable row level security;

drop policy if exists "Owners can manage their pet timeline entries" on public.pet_timeline_entries;
create policy "Owners can manage their pet timeline entries"
on public.pet_timeline_entries for all to authenticated
using (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.soul_trace_pets pets
    where pets.pet_id = pet_timeline_entries.pet_id
      and pets.owner_user_id = auth.uid()
  )
)
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.soul_trace_pets pets
    where pets.pet_id = pet_timeline_entries.pet_id
      and pets.owner_user_id = auth.uid()
  )
);

drop policy if exists "Owners can manage their pet timeline assets" on public.pet_timeline_assets;
create policy "Owners can manage their pet timeline assets"
on public.pet_timeline_assets for all to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.pet_timeline_entries entries
    where entries.entry_id = pet_timeline_assets.entry_id
      and entries.owner_user_id = auth.uid()
      and entries.pet_id = pet_timeline_assets.pet_id
  )
);

revoke all on table public.pet_timeline_entries from public, anon;
revoke all on table public.pet_timeline_assets from public, anon;
grant select, insert, update, delete on table public.pet_timeline_entries to authenticated;
grant select, insert, update, delete on table public.pet_timeline_assets to authenticated;

comment on table public.pet_timeline_entries is
  'Letter-free pet timeline. Private to the owner. Does not replace life_archive_* rows.';
comment on column public.soul_trace_pets.life_status is
  'living, memorial, or unspecified. Changing it must not delete letters or memories.';
