-- READ-ONLY PREFLIGHT - safe to review; not executed during the repository audit.
-- Run in the isolated local database first. Results contain schema metadata and
-- aggregate counts only, not customer emails, letters, tokens, or media paths.

-- Required owner/pet and legacy relations.
select to_regclass('public.soul_trace_owners') as owners_table,
       to_regclass('public.soul_trace_pets') as pets_table,
       to_regclass('public.soul_trace_profiles') as legacy_profiles,
       to_regclass('public.soul_trace_answers') as legacy_answers,
       to_regclass('public.soul_trace_legacy_links') as legacy_links,
       to_regclass('public.soul_trace_submissions') as submissions,
       to_regclass('public.life_archive_memories') as archive_memories,
       to_regclass('public.life_archive_photo_moments') as archive_photo_moments,
       to_regclass('public.life_archive_photos') as archive_photos,
       to_regclass('public.life_archive_videos') as archive_videos,
       to_regclass('public.seasonal_polaroid_results') as seasonal_polaroid_results;

-- Owner/pet columns and types.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('soul_trace_owners', 'soul_trace_pets')
order by table_name, ordinal_position;

-- Owner RPC prerequisite: user_id is supplied by auth.uid(); every other
-- NOT NULL owner column must have a default so the RPC can insert only user_id.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'soul_trace_owners'
order by ordinal_position;

select a.attname as required_owner_column_without_default
from pg_attribute a
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where a.attrelid = 'public.soul_trace_owners'::regclass
  and a.attnum > 0 and not a.attisdropped
  and a.attname <> 'user_id' and a.attnotnull and d.oid is null;

-- Keys, foreign keys, and delete behavior.
select rel.relname as table_name, con.conname, con.contype,
       con.confdeltype, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public'
  and rel.relname in ('soul_trace_owners', 'soul_trace_pets')
order by rel.relname, con.conname;

-- Pet RLS state and current policies; retain the existing SELECT policy.
select c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace ns on ns.oid = c.relnamespace
where ns.nspname = 'public' and c.relname in ('soul_trace_owners', 'soul_trace_pets');

-- Existing table privileges; Stage A does not change any soul_trace_pets grants.
-- Preserve this output to compare against the postflight.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('soul_trace_owners', 'soul_trace_pets')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- Direct table ACL, including PUBLIC grants that can be inherited by roles.
select c.relname as table_name,
       case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end as grantee,
       acl.privilege_type,
       acl.is_grantable
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
where n.nspname = 'public'
  and c.relname in ('soul_trace_owners', 'soul_trace_pets')
  and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE')
order by table_name, grantee, acl.privilege_type;

-- Existing roles must retain the privileges required by both applications.
select has_table_privilege('authenticated', 'public.soul_trace_pets', 'SELECT') as authenticated_can_select_pets,
       has_table_privilege('authenticated', 'public.soul_trace_pets', 'INSERT') as authenticated_can_insert_pets,
       has_table_privilege('authenticated', 'public.soul_trace_pets', 'UPDATE') as authenticated_can_update_pets,
       has_table_privilege('service_role', 'public.soul_trace_pets', 'SELECT') as service_role_can_select_pets,
       has_table_privilege('service_role', 'public.soul_trace_pets', 'INSERT') as service_role_can_insert_pets,
       has_table_privilege('service_role', 'public.soul_trace_pets', 'UPDATE') as service_role_can_update_pets;

-- Role membership paths that could supply or inherit table privileges.
with recursive role_inheritance(member, inherited_role, path) as (
  select member, roleid, array[member, roleid]::oid[]
  from pg_auth_members
  union all
  select inheritance.member, membership.roleid, inheritance.path || membership.roleid
  from role_inheritance inheritance
  join pg_auth_members membership on membership.member = inheritance.inherited_role
  where not membership.roleid = any(inheritance.path)
)
select member::regrole as member_role, inherited_role::regrole as inherited_role
from role_inheritance
order by member_role, inherited_role;

-- UUID and timestamp defaults are required because the create-pet API omits both.
select column_name, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'soul_trace_pets'
  and column_name in ('pet_id', 'created_at');

-- SECURITY DEFINER owner-RPC prerequisite: report the migration role and the
-- intended trusted owner. The core draft pins the function owner to postgres.
select current_user as preflight_role,
       r.rolsuper, r.rolbypassrls,
       (current_user = 'postgres' or r.rolsuper or pg_has_role(current_user, 'postgres', 'MEMBER'))
         as can_assign_function_owner_to_postgres,
       has_table_privilege('postgres', 'public.soul_trace_owners', 'INSERT') as postgres_can_insert_owner
from pg_roles r where r.rolname = current_user;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('soul_trace_owners', 'soul_trace_pets')
order by tablename, policyname;

-- Existing counts and legacy-link coverage. Previously verified production
-- reference: 323 pets (127 owned, 196 unowned); compare saved outputs exactly.
select count(*) as pets,
       count(*) filter (where owner_user_id is not null) as pets_with_owner,
       count(*) filter (where owner_user_id is null) as pets_without_owner
from public.soul_trace_pets;

select count(*) as owner_rows from public.soul_trace_owners;

select count(*) as pets_without_any_legacy_link
from public.soul_trace_pets pets
where not exists (
  select 1 from public.soul_trace_legacy_links links
   where links.pet_id = pets.pet_id
);

select count(*) as links_without_pet
from public.soul_trace_legacy_links links
left join public.soul_trace_pets pets on pets.pet_id = links.pet_id
where pets.pet_id is null;

select 'seasonal_polaroid_results' as table_name, count(*) as row_count
from public.seasonal_polaroid_results;

select count(*) as submissions_without_matching_pet
from public.soul_trace_submissions submissions
left join public.soul_trace_pets pets on pets.pet_id = submissions.pet_id
where pets.pet_id is null;

-- Confirm Pet-First objects are actually absent or identify partial application.
select to_regclass('public.pet_timeline_entries') as timeline_entries,
       to_regclass('public.pet_timeline_assets') as timeline_assets,
       to_regclass('public.pet_mood_journal') as mood_journal,
       to_regclass('public.beam_scene_previews') as beam_scene_previews,
       to_regprocedure('public.ensure_soul_trace_owner()') as owner_setup_rpc;

select conname, conrelid::regclass as relation_name, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'soul_trace_pets_life_status_check';

-- Existing legacy sync triggers are inspected, not replaced by this draft.
select event_object_table as table_name, trigger_name, action_timing,
       event_manipulation, action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in (
    'soul_trace_owners', 'soul_trace_pets',
    'soul_trace_profiles', 'soul_trace_answers'
  )
order by event_object_table, trigger_name, event_manipulation;

-- These existing SECURITY DEFINER functions perform legacy pet/owner writes.
-- Record deployed function owners, RLS bypass status, settings, and table rights.
select to_regprocedure('public.sync_soul_trace_legacy_profile()') as legacy_profile_sync_function,
       to_regprocedure('public.claim_soul_trace_legacy_records()') as legacy_account_recovery_function;

select p.oid::regprocedure as function_name,
       r.rolname as function_owner,
       r.rolsuper,
       r.rolbypassrls,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       has_table_privilege(p.proowner, 'public.soul_trace_pets', 'SELECT') as owner_can_select_pets,
       has_table_privilege(p.proowner, 'public.soul_trace_pets', 'INSERT') as owner_can_insert_pets,
       has_table_privilege(p.proowner, 'public.soul_trace_pets', 'UPDATE') as owner_can_update_pets,
       has_table_privilege(p.proowner, 'public.soul_trace_owners', 'INSERT') as owner_can_insert_owner,
       has_table_privilege(p.proowner, 'public.soul_trace_owners', 'UPDATE') as owner_can_update_owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and p.oid in (
    to_regprocedure('public.sync_soul_trace_legacy_profile()'),
    to_regprocedure('public.claim_soul_trace_legacy_records()')
  )
order by function_name;

select c.relname as table_name, c.relowner::regrole as table_owner,
       c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('soul_trace_pets', 'soul_trace_owners');

select case when to_regprocedure('public.claim_soul_trace_legacy_records()') is not null
         then has_function_privilege('anon', 'public.claim_soul_trace_legacy_records()', 'EXECUTE') end
         as anon_can_claim_legacy,
       case when to_regprocedure('public.claim_soul_trace_legacy_records()') is not null
         then has_function_privilege('authenticated', 'public.claim_soul_trace_legacy_records()', 'EXECUTE') end
         as authenticated_can_claim_legacy;

-- Storage is deliberately not changed by the core draft. Verify existing
-- private bucket limits/MIME types and owner-folder policies before enabling uploads.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('life-archive-photos', 'life-archive-videos')
order by id;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (
    coalesce(qual, '') ilike '%life-archive-photos%'
    or coalesce(with_check, '') ilike '%life-archive-photos%'
    or coalesce(qual, '') ilike '%life-archive-videos%'
    or coalesce(with_check, '') ilike '%life-archive-videos%'
  )
order by policyname;

-- Expected Storage coverage is SELECT/INSERT/DELETE scoped to the authenticated
-- user's first path segment for each private bucket. Review each predicate above.

-- Storage object counts by bucket only; no object names or paths are returned.
select bucket_id, count(*) as object_count
from storage.objects
where bucket_id in ('life-archive-photos', 'life-archive-videos')
group by bucket_id
order by bucket_id;
