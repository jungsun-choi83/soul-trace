-- STAGE A REVIEW DRAFT ONLY - NOT EXECUTED.
-- Adds the Pet-First foundation while leaving legacy data, functions, triggers,
-- Storage settings, and existing soul_trace_pets grants untouched.
-- Run only after review, backup/restore rehearsal, and a fresh read-only preflight.

begin;

do $preflight$
declare
  owner_id_attnum smallint;
  auth_id_attnum smallint;
  pet_id_attnum smallint;
  pet_owner_attnum smallint;
begin
  if current_user <> 'postgres' then
    raise exception 'Stage A must run as postgres in the existing Supabase SQL Editor';
  end if;

  if to_regclass('public.soul_trace_owners') is null
     or to_regclass('public.soul_trace_pets') is null then
    raise exception 'Required existing owner/pet tables are missing';
  end if;

  select attnum into owner_id_attnum
    from pg_attribute
   where attrelid = 'public.soul_trace_owners'::regclass
     and attname = 'user_id' and atttypid = 'uuid'::regtype and not attisdropped;
  select attnum into auth_id_attnum
    from pg_attribute
   where attrelid = 'auth.users'::regclass
     and attname = 'id' and atttypid = 'uuid'::regtype and not attisdropped;
  select attnum into pet_id_attnum
    from pg_attribute
   where attrelid = 'public.soul_trace_pets'::regclass
     and attname = 'pet_id' and atttypid = 'uuid'::regtype and not attisdropped;
  select attnum into pet_owner_attnum
    from pg_attribute
   where attrelid = 'public.soul_trace_pets'::regclass
     and attname = 'owner_user_id' and atttypid = 'uuid'::regtype and not attisdropped;

  if owner_id_attnum is null or auth_id_attnum is null
     or pet_id_attnum is null or pet_owner_attnum is null then
    raise exception 'Existing owner/pet key columns do not match the reviewed UUID schema';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.soul_trace_owners'::regclass
       and contype = 'p' and conkey = array[owner_id_attnum]::smallint[]
  ) or not exists (
    select 1 from pg_constraint
     where conrelid = 'public.soul_trace_pets'::regclass
       and contype = 'p' and conkey = array[pet_id_attnum]::smallint[]
  ) then
    raise exception 'Existing owner/pet primary keys do not match the reviewed schema';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.soul_trace_pets'::regclass
       and confrelid = 'public.soul_trace_owners'::regclass
       and contype = 'f'
       and conkey = array[pet_owner_attnum]::smallint[]
       and confkey = array[owner_id_attnum]::smallint[]
       and confdeltype = 'c'
  ) or not exists (
    select 1 from pg_constraint
     where conrelid = 'public.soul_trace_owners'::regclass
       and confrelid = 'auth.users'::regclass
       and contype = 'f'
       and conkey = array[owner_id_attnum]::smallint[]
       and confkey = array[auth_id_attnum]::smallint[]
       and confdeltype = 'c'
  ) then
    raise exception 'Existing owner/pet foreign keys do not match the reviewed schema';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'soul_trace_pets'
       and column_name = 'pet_id' and column_default like '%gen_random_uuid%'
  ) or not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'soul_trace_pets'
       and column_name = 'created_at' and data_type = 'timestamp with time zone'
       and column_default like '%now()%'
  ) then
    raise exception 'Existing pet UUID/created_at defaults do not match application inserts';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'soul_trace_pets'
       and column_name = 'pet_name' and data_type = 'text' and is_nullable = 'NO'
  ) then
    raise exception 'Existing soul_trace_pets.pet_name must be required text';
  end if;

  if exists (
    select 1 from pg_attribute a
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
     where a.attrelid = 'public.soul_trace_owners'::regclass
       and a.attnum > 0 and not a.attisdropped
       and a.attname <> 'user_id' and a.attnotnull and d.oid is null
  ) then
    raise exception 'Owner table has another required column without a default';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.soul_trace_owners'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.soul_trace_pets'::regclass) then
    raise exception 'RLS must already be enabled on both existing owner/pet tables';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'soul_trace_pets'
       and policyname = 'Owners can read their pets'
       and cmd = 'SELECT' and 'authenticated' = any(roles)
       and qual ilike '%owner_user_id%auth.uid()%'
  ) then
    raise exception 'Existing authenticated owner-scoped pet SELECT policy is missing';
  end if;

  -- Stage A adds owner-scoped policies but deliberately does not change grants
  -- on the existing pet table. The app and original service routes already use them.
  if not has_table_privilege('authenticated', 'public.soul_trace_pets', 'SELECT')
     or not has_table_privilege('authenticated', 'public.soul_trace_pets', 'INSERT')
     or not has_table_privilege('authenticated', 'public.soul_trace_pets', 'UPDATE')
     or not has_table_privilege('service_role', 'public.soul_trace_pets', 'SELECT')
     or not has_table_privilege('service_role', 'public.soul_trace_pets', 'INSERT')
     or not has_table_privilege('service_role', 'public.soul_trace_pets', 'UPDATE') then
    raise exception 'Existing authenticated/service_role pet privileges are not as reviewed';
  end if;

  if to_regclass('public.pet_timeline_entries') is not null
     or to_regclass('public.pet_timeline_assets') is not null
     or to_regprocedure('public.ensure_soul_trace_owner()') is not null
     or to_regprocedure('public.guard_soul_trace_pet_identity()') is not null
     or exists (
       select 1 from pg_trigger
        where tgrelid = 'public.soul_trace_pets'::regclass
          and tgname = 'soul_trace_pets_guard_identity_before_update'
          and not tgisinternal
     ) then
    raise exception 'A Stage A object already exists; inspect partial schema before applying';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'soul_trace_pets'
       and column_name in ('life_status', 'species', 'birthday', 'adopted_on', 'traits', 'updated_at')
  ) or exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and policyname in (
         'pet_first_authenticated_create_pet',
         'pet_first_authenticated_update_pet',
         'pet_first_timeline_entries_owner_all',
         'pet_first_timeline_assets_owner_all'
       )
  ) or exists (
    select 1 from pg_constraint
     where conrelid = 'public.soul_trace_pets'::regclass
       and conname = 'soul_trace_pets_life_status_check'
  ) then
    raise exception 'A Stage A profile column, policy, or constraint already exists';
  end if;
end;
$preflight$;

-- Existing pets receive only the neutral status default. No owner or status
-- backfill occurs; other profile values remain NULL until supplied by the user.
alter table public.soul_trace_pets
  add column life_status text not null default 'unspecified',
  add column species text,
  add column birthday date,
  add column adopted_on date,
  add column traits text,
  add column updated_at timestamptz;

alter table public.soul_trace_pets
  add constraint soul_trace_pets_life_status_check
  check (life_status in ('living', 'memorial', 'unspecified'));

-- Authenticated users may edit their pet profile, but cannot change the row's
-- identity, creation time, or owner. Trusted service_role and existing
-- SECURITY DEFINER legacy routines retain their current ability to manage rows.
create function public.guard_soul_trace_pet_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if current_user = 'authenticated'
     and (
       new.pet_id is distinct from old.pet_id
       or new.created_at is distinct from old.created_at
       or new.owner_user_id is distinct from old.owner_user_id
     ) then
    raise exception 'pet_identity_fields_are_immutable';
  end if;

  return new;
end;
$function$;

create trigger soul_trace_pets_guard_identity_before_update
before update on public.soul_trace_pets
for each row execute function public.guard_soul_trace_pet_identity();

create function public.ensure_soul_trace_owner()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  insert into public.soul_trace_owners (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;
end;
$function$;

-- Only authenticated sessions may create the caller's owner row through RPC.
revoke all on function public.ensure_soul_trace_owner() from public, anon;
grant execute on function public.ensure_soul_trace_owner() to authenticated;

create policy pet_first_authenticated_create_pet
on public.soul_trace_pets for insert to authenticated
with check (owner_user_id = auth.uid());

create policy pet_first_authenticated_update_pet
on public.soul_trace_pets for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create table public.pet_timeline_entries (
  entry_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete cascade,
  kind text not null check (kind in ('photo', 'video', 'text')),
  title text,
  story text,
  place text,
  favorite boolean not null default false,
  happened_on date,
  visibility text not null default 'private' check (visibility = 'private'),
  origin text not null default 'pet_first_archive' check (origin = 'pet_first_archive'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_timeline_entries_text_story check (
    kind <> 'text' or (story is not null and char_length(btrim(story)) between 1 and 2000)
  ),
  constraint pet_timeline_entries_place_check check (
    place is null or char_length(btrim(place)) between 1 and 80
  )
);

create table public.pet_timeline_assets (
  asset_id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.pet_timeline_entries (entry_id) on delete cascade,
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete cascade,
  storage_bucket text not null check (storage_bucket in ('life-archive-photos', 'life-archive-videos')),
  storage_path text not null unique,
  constraint pet_timeline_assets_owner_path_check check (
    split_part(storage_path, '/', 1) = owner_user_id::text
    and split_part(storage_path, '/', 2) = pet_id::text
    and split_part(storage_path, '/', 3) = 'pet-first'
    and split_part(storage_path, '/', 4) = entry_id::text
    and array_length(string_to_array(storage_path, '/'), 1) = 5
    and split_part(storage_path, '/', 5) <> ''
  ),
  content_type text not null,
  constraint pet_timeline_assets_bucket_content_type_check check (
    (storage_bucket = 'life-archive-photos' and content_type in ('image/jpeg', 'image/png', 'image/webp'))
    or (storage_bucket = 'life-archive-videos' and content_type in ('video/mp4', 'video/webm', 'video/quicktime'))
  ),
  byte_size bigint not null check (
    (storage_bucket = 'life-archive-photos' and byte_size between 1 and 10485760)
    or (storage_bucket = 'life-archive-videos' and byte_size between 1 and 52428800)
  ),
  asset_order integer not null check (
    (storage_bucket = 'life-archive-photos' and asset_order between 0 and 4)
    or (storage_bucket = 'life-archive-videos' and asset_order = 0)
  ),
  created_at timestamptz not null default now(),
  unique (entry_id, asset_order)
);

create index pet_timeline_entries_pet_idx
  on public.pet_timeline_entries (owner_user_id, pet_id, created_at desc);
create index pet_timeline_assets_entry_idx
  on public.pet_timeline_assets (entry_id, asset_order);

alter table public.pet_timeline_entries enable row level security;
alter table public.pet_timeline_assets enable row level security;

create policy pet_first_timeline_entries_owner_all
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

create policy pet_first_timeline_assets_owner_all
on public.pet_timeline_assets for all to authenticated
using (
  owner_user_id = auth.uid()
  and split_part(storage_path, '/', 1) = auth.uid()::text
  and exists (
    select 1 from public.pet_timeline_entries entries
     where entries.entry_id = pet_timeline_assets.entry_id
       and entries.owner_user_id = auth.uid()
       and entries.pet_id = pet_timeline_assets.pet_id
  )
)
with check (
  owner_user_id = auth.uid()
  and split_part(storage_path, '/', 1) = auth.uid()::text
  and exists (
    select 1 from public.pet_timeline_entries entries
     where entries.entry_id = pet_timeline_assets.entry_id
       and entries.owner_user_id = auth.uid()
       and entries.pet_id = pet_timeline_assets.pet_id
  )
);

-- Current timeline APIs use the authenticated session client. Restrict the new
-- tables to that client and avoid inherited/default service_role table grants;
-- existing pet/owner service_role privileges are not changed.
revoke all on table public.pet_timeline_entries from public, anon, service_role;
revoke all on table public.pet_timeline_assets from public, anon, service_role;
grant select, insert, update, delete on table public.pet_timeline_entries to authenticated;
grant select, insert, update, delete on table public.pet_timeline_assets to authenticated;

comment on table public.pet_timeline_entries is
  'Pet-first memories; separate from legacy submission-based Life Archive records.';
comment on column public.soul_trace_pets.life_status is
  'living, memorial, or unspecified; historical pets default to unspecified.';
comment on column public.pet_timeline_entries.place is
  'Optional owner-entered place; never inferred from GPS.';

commit;
