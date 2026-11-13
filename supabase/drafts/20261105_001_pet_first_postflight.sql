-- READ-ONLY STAGE A POSTFLIGHT. Never run as part of the migration transaction.
-- Compare all counts and metadata with the saved preflight output.

-- Pet count and ownership/status distribution. The prior reference was 323
-- total, 127 owned, and 196 unowned; use the fresh preflight as the baseline.
select count(*) as pets,
       count(*) filter (where owner_user_id is not null) as pets_with_owner,
       count(*) filter (where owner_user_id is null) as pets_without_owner,
       count(*) filter (where life_status = 'unspecified') as unspecified_status,
       count(*) filter (where life_status = 'living') as living_status,
       count(*) filter (where life_status = 'memorial') as memorial_status
from public.soul_trace_pets;

select count(*) as owner_rows from public.soul_trace_owners;

-- Historical data must match preflight; Stage A does not write these tables.
select 'profiles' as table_name, count(*) as row_count from public.soul_trace_profiles
union all select 'answers', count(*) from public.soul_trace_answers
union all select 'legacy_links', count(*) from public.soul_trace_legacy_links
union all select 'submissions', count(*) from public.soul_trace_submissions
union all select 'archive_memories', count(*) from public.life_archive_memories
union all select 'archive_photo_moments', count(*) from public.life_archive_photo_moments
union all select 'archive_photos', count(*) from public.life_archive_photos
union all select 'archive_videos', count(*) from public.life_archive_videos
union all select 'seasonal_polaroid_results', count(*) from public.seasonal_polaroid_results
order by table_name;

select count(*) as pets_without_any_legacy_link
from public.soul_trace_pets pets
where not exists (
  select 1 from public.soul_trace_legacy_links links where links.pet_id = pets.pet_id
);

select count(*) as links_without_pet
from public.soul_trace_legacy_links links
left join public.soul_trace_pets pets on pets.pet_id = links.pet_id
where pets.pet_id is null;

select count(*) as submissions_without_matching_pet
from public.soul_trace_submissions submissions
left join public.soul_trace_pets pets on pets.pet_id = submissions.pet_id
where pets.pet_id is null;

-- Existing pet-table privileges are intentionally untouched by Stage A.
select has_table_privilege('authenticated', 'public.soul_trace_pets', 'SELECT') as authenticated_can_select_pets,
       has_table_privilege('authenticated', 'public.soul_trace_pets', 'INSERT') as authenticated_can_insert_pets,
       has_table_privilege('authenticated', 'public.soul_trace_pets', 'UPDATE') as authenticated_can_update_pets,
       has_table_privilege('service_role', 'public.soul_trace_pets', 'SELECT') as service_role_can_select_pets,
       has_table_privilege('service_role', 'public.soul_trace_pets', 'INSERT') as service_role_can_insert_pets,
       has_table_privilege('service_role', 'public.soul_trace_pets', 'UPDATE') as service_role_can_update_pets;

do $verify_existing_pet_access$
begin
  if not has_table_privilege('authenticated', 'public.soul_trace_pets', 'SELECT')
     or not has_table_privilege('authenticated', 'public.soul_trace_pets', 'INSERT')
     or not has_table_privilege('authenticated', 'public.soul_trace_pets', 'UPDATE')
     or not has_table_privilege('service_role', 'public.soul_trace_pets', 'SELECT')
     or not has_table_privilege('service_role', 'public.soul_trace_pets', 'INSERT')
     or not has_table_privilege('service_role', 'public.soul_trace_pets', 'UPDATE') then
    raise exception 'Existing authenticated/service_role pet privileges changed';
  end if;
end;
$verify_existing_pet_access$;

-- New schema columns, defaults, and constraints.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'soul_trace_pets' and column_name in
      ('life_status', 'species', 'birthday', 'adopted_on', 'traits', 'updated_at'))
    or table_name in ('pet_timeline_entries', 'pet_timeline_assets')
  )
order by table_name, ordinal_position;

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.soul_trace_pets'::regclass,
  'public.pet_timeline_entries'::regclass,
  'public.pet_timeline_assets'::regclass
)
order by table_name, conname;

select (select count(*) from public.pet_timeline_entries) as timeline_entries,
       (select count(*) from public.pet_timeline_assets) as timeline_assets;

-- RLS plus the preserved pet SELECT and new owner-scoped pet/timeline policies.
select c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('soul_trace_owners', 'soul_trace_pets', 'pet_timeline_entries', 'pet_timeline_assets');

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('soul_trace_owners', 'soul_trace_pets', 'pet_timeline_entries', 'pet_timeline_assets')
order by tablename, policyname;

do $verify_pet_policies$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'soul_trace_pets'
      and policyname = 'Owners can read their pets' and cmd = 'SELECT'
      and 'authenticated' = any(roles) and qual ilike '%owner_user_id%auth.uid()%'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'soul_trace_pets'
      and policyname = 'pet_first_authenticated_create_pet' and cmd = 'INSERT'
      and 'authenticated' = any(roles) and with_check ilike '%owner_user_id%auth.uid()%'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'soul_trace_pets'
      and policyname = 'pet_first_authenticated_update_pet' and cmd = 'UPDATE'
      and 'authenticated' = any(roles) and qual ilike '%owner_user_id%auth.uid()%'
      and with_check ilike '%owner_user_id%auth.uid()%'
  ) then
    raise exception 'Existing owner-scoped pet SELECT or Stage A pet write policies are missing';
  end if;
end;
$verify_pet_policies$;

-- Authenticated pet profile updates must not alter identity, original creation
-- time, or ownership. Trigger is invoker-security so service_role and existing
-- postgres-owned SECURITY DEFINER legacy routines keep trusted behavior.
select t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as trigger_definition,
       p.oid::regprocedure as trigger_function, r.rolname as function_owner,
       p.prosecdef as security_definer, p.proconfig as function_settings,
       p.prosrc as trigger_function_source
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_roles r on r.oid = p.proowner
where t.tgrelid = 'public.soul_trace_pets'::regclass
  and t.tgname = 'soul_trace_pets_guard_identity_before_update'
  and not t.tgisinternal;

do $verify_pet_identity_guard$
declare
  trigger_enabled "char";
  trigger_definition text;
  function_owner text;
  is_security_definer boolean;
  function_settings text[];
  function_source text;
begin
  select t.tgenabled, pg_get_triggerdef(t.oid), r.rolname, p.prosecdef, p.proconfig, p.prosrc
    into trigger_enabled, trigger_definition, function_owner, is_security_definer, function_settings, function_source
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    join pg_roles r on r.oid = p.proowner
   where t.tgrelid = 'public.soul_trace_pets'::regclass
     and t.tgname = 'soul_trace_pets_guard_identity_before_update'
     and not t.tgisinternal;

  if trigger_enabled is distinct from 'O'
     or trigger_definition not ilike '%BEFORE UPDATE%'
     or trigger_definition not ilike '%FOR EACH ROW%'
     or function_owner is distinct from 'postgres'
     or is_security_definer is distinct from false
     or function_settings is null
     or not ('search_path=""' = any(function_settings))
     or function_source not ilike '%current_user = ''authenticated''%'
     or function_source not ilike '%new.pet_id%old.pet_id%'
     or function_source not ilike '%new.created_at%old.created_at%'
     or function_source not ilike '%new.owner_user_id%old.owner_user_id%' then
    raise exception 'Pet identity guard trigger is missing or does not protect the expected fields';
  end if;
end;
$verify_pet_identity_guard$;

do $verify_timeline_access$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pet_timeline_entries'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.pet_timeline_assets'::regclass)
     or not has_table_privilege('authenticated', 'public.pet_timeline_entries', 'SELECT')
     or not has_table_privilege('authenticated', 'public.pet_timeline_entries', 'INSERT')
     or not has_table_privilege('authenticated', 'public.pet_timeline_entries', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.pet_timeline_entries', 'DELETE')
     or not has_table_privilege('authenticated', 'public.pet_timeline_assets', 'SELECT')
     or not has_table_privilege('authenticated', 'public.pet_timeline_assets', 'INSERT')
     or not has_table_privilege('authenticated', 'public.pet_timeline_assets', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.pet_timeline_assets', 'DELETE')
     or has_table_privilege('anon', 'public.pet_timeline_entries', 'SELECT')
     or has_table_privilege('anon', 'public.pet_timeline_entries', 'INSERT')
     or has_table_privilege('anon', 'public.pet_timeline_entries', 'UPDATE')
     or has_table_privilege('anon', 'public.pet_timeline_entries', 'DELETE')
     or has_table_privilege('anon', 'public.pet_timeline_assets', 'SELECT')
     or has_table_privilege('anon', 'public.pet_timeline_assets', 'INSERT')
     or has_table_privilege('anon', 'public.pet_timeline_assets', 'UPDATE')
     or has_table_privilege('anon', 'public.pet_timeline_assets', 'DELETE')
     or has_table_privilege('service_role', 'public.pet_timeline_entries', 'SELECT')
     or has_table_privilege('service_role', 'public.pet_timeline_entries', 'INSERT')
     or has_table_privilege('service_role', 'public.pet_timeline_entries', 'UPDATE')
     or has_table_privilege('service_role', 'public.pet_timeline_entries', 'DELETE')
     or has_table_privilege('service_role', 'public.pet_timeline_assets', 'SELECT')
     or has_table_privilege('service_role', 'public.pet_timeline_assets', 'INSERT')
     or has_table_privilege('service_role', 'public.pet_timeline_assets', 'UPDATE')
     or has_table_privilege('service_role', 'public.pet_timeline_assets', 'DELETE') then
    raise exception 'Timeline RLS or authenticated table privileges are missing';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'pet_timeline_entries'
      and policyname = 'pet_first_timeline_entries_owner_all'
      and cmd = 'ALL' and 'authenticated' = any(roles)
      and qual ilike '%owner_user_id%auth.uid()%'
      and qual ilike '%soul_trace_pets%'
      and with_check ilike '%owner_user_id%auth.uid()%'
      and with_check ilike '%soul_trace_pets%'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'pet_timeline_assets'
      and policyname = 'pet_first_timeline_assets_owner_all'
      and cmd = 'ALL' and 'authenticated' = any(roles)
      and qual ilike '%owner_user_id%auth.uid()%'
      and qual ilike '%split_part(storage_path%'
      and qual ilike '%pet_timeline_entries%'
      and with_check ilike '%owner_user_id%auth.uid()%'
      and with_check ilike '%split_part(storage_path%'
      and with_check ilike '%pet_timeline_entries%'
  ) then
    raise exception 'Timeline owner-scoped RLS policies are missing or changed';
  end if;
end;
$verify_timeline_access$;

do $verify_memory_metadata$
begin
  if not exists (
    select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'pet_timeline_entries' and column_name = 'place'
      and data_type = 'text' and is_nullable = 'YES'
  ) or not exists (
    select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'pet_timeline_entries' and column_name = 'favorite'
      and data_type = 'boolean' and is_nullable = 'NO'
      and column_default in ('false', 'false::boolean')
  ) or not exists (
    select 1 from pg_constraint where conrelid = 'public.pet_timeline_entries'::regclass
      and conname = 'pet_timeline_entries_place_check'
      and pg_get_constraintdef(oid) ilike '%btrim(place)%'
      and pg_get_constraintdef(oid) ilike '%80%'
  ) then
    raise exception 'Memory place/favorite fields or place constraint are missing';
  end if;
end;
$verify_memory_metadata$;

do $verify_asset_path_constraint$
declare
  path_definition text;
begin
  select pg_get_constraintdef(oid) into path_definition
    from pg_constraint
   where conrelid = 'public.pet_timeline_assets'::regclass
     and conname = 'pet_timeline_assets_owner_path_check';

  if path_definition is null
     or path_definition not ilike '%split_part(storage_path%'
     or path_definition not ilike '%owner_user_id%'
     or path_definition not ilike '%pet_id%'
     or path_definition not ilike '%pet-first%'
     or path_definition not ilike '%entry_id%'
     or path_definition not ilike '%array_length%' then
    raise exception 'Asset path constraint is missing or does not bind paths to owner/pet/entry';
  end if;
end;
$verify_asset_path_constraint$;

-- New owner RPC must be postgres-owned SECURITY DEFINER with an empty search path.
select p.oid::regprocedure as function_name, r.rolname as function_owner,
       r.rolsuper, r.rolbypassrls, p.prosecdef as security_definer,
       p.proconfig as function_settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_roles r on r.oid = p.proowner
where p.oid = 'public.ensure_soul_trace_owner()'::regprocedure;

do $verify_owner_rpc$
declare
  rpc_owner text;
  rpc_security_definer boolean;
  rpc_settings text[];
begin
  select r.rolname, p.prosecdef, p.proconfig
    into rpc_owner, rpc_security_definer, rpc_settings
    from pg_proc p join pg_roles r on r.oid = p.proowner
   where p.oid = 'public.ensure_soul_trace_owner()'::regprocedure;

  if rpc_owner is distinct from 'postgres'
     or rpc_security_definer is not true
     or rpc_settings is null
     or not ('search_path=""' = any(rpc_settings))
     or has_function_privilege('anon', 'public.ensure_soul_trace_owner()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.ensure_soul_trace_owner()', 'EXECUTE') then
    raise exception 'Owner RPC owner, security settings, or execute grants are incorrect';
  end if;
end;
$verify_owner_rpc$;

-- Legacy functions are not replaced; compare owners/settings with preflight.
select p.oid::regprocedure as function_name, r.rolname as function_owner,
       p.prosecdef as security_definer, p.proconfig as function_settings
from pg_proc p join pg_roles r on r.oid = p.proowner
where p.oid in (
  to_regprocedure('public.sync_soul_trace_legacy_profile()'),
  to_regprocedure('public.claim_soul_trace_legacy_records()')
)
order by function_name;

-- Storage is not modified. Compare bucket object counts with preflight without
-- selecting customer file paths or names.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('life-archive-photos', 'life-archive-videos')
order by id;

select bucket_id, count(*) as object_count
from storage.objects
where bucket_id in ('life-archive-photos', 'life-archive-videos')
group by bucket_id
order by bucket_id;
