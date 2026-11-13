-- READ ONLY preflight for 20261106_002_pet_first_letter_persistence.sql.
-- Run only in the intended database after approval. It reports metadata and
-- aggregate counts; it does not expose emails, letter text, or pet names.

select
  to_regclass('public.soul_trace_profiles') is not null as profiles_table_exists,
  to_regclass('public.soul_trace_pets') is not null as pets_table_exists,
  to_regclass('public.soul_trace_owners') is not null as owners_table_exists,
  to_regclass('public.soul_trace_submissions') is not null as submissions_table_exists,
  to_regclass('public.soul_trace_legacy_links') is not null as legacy_links_table_exists,
  to_regclass('auth.users') is not null as auth_users_exists;

select table_schema, table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where (table_schema, table_name, column_name) in (
  ('public', 'soul_trace_profiles', 'letter_id'),
  ('public', 'soul_trace_profiles', 'user_email'),
  ('public', 'soul_trace_profiles', 'pet_id'),
  ('public', 'soul_trace_profiles', 'pet_name'),
  ('public', 'soul_trace_profiles', 'personality_type'),
  ('public', 'soul_trace_profiles', 'generated_letter'),
  ('public', 'soul_trace_profiles', 'letter_title'),
  ('public', 'soul_trace_profiles', 'letter_ending_phrase'),
  ('public', 'soul_trace_profiles', 'letter_mode'),
  ('public', 'soul_trace_profiles', 'service_channel'),
  ('public', 'soul_trace_profiles', 'preferred_scenery'),
  ('public', 'soul_trace_profiles', 'generation_locale'),
  ('public', 'soul_trace_profiles', 'hero_image_url'),
  ('public', 'soul_trace_profiles', 'hero_image_ref'),
  ('public', 'soul_trace_profiles', 'created_at'),
  ('public', 'soul_trace_pets', 'pet_id'),
  ('public', 'soul_trace_pets', 'owner_user_id'),
  ('public', 'soul_trace_pets', 'pet_name'),
  ('public', 'soul_trace_pets', 'created_at'),
  ('public', 'soul_trace_owners', 'user_id'),
  ('public', 'soul_trace_submissions', 'submission_id'),
  ('public', 'soul_trace_submissions', 'pet_id'),
  ('public', 'soul_trace_submissions', 'owner_user_id'),
  ('public', 'soul_trace_submissions', 'letter_id'),
  ('public', 'soul_trace_submissions', 'generated_letter'),
  ('public', 'soul_trace_submissions', 'letter_title'),
  ('public', 'soul_trace_submissions', 'letter_ending_phrase'),
  ('public', 'soul_trace_submissions', 'letter_mode'),
  ('public', 'soul_trace_submissions', 'service_channel'),
  ('public', 'soul_trace_submissions', 'personality_type'),
  ('public', 'soul_trace_submissions', 'preferred_scenery'),
  ('public', 'soul_trace_submissions', 'generation_locale'),
  ('public', 'soul_trace_submissions', 'hero_image_url'),
  ('public', 'soul_trace_submissions', 'hero_image_ref'),
  ('public', 'soul_trace_submissions', 'created_at'),
  ('public', 'soul_trace_legacy_links', 'user_email'),
  ('public', 'soul_trace_legacy_links', 'pet_id'),
  ('public', 'soul_trace_legacy_links', 'submission_id'),
  ('public', 'soul_trace_legacy_links', 'letter_id'),
  ('auth', 'users', 'id'),
  ('auth', 'users', 'email'),
  ('auth', 'users', 'email_confirmed_at')
)
order by table_schema, table_name, ordinal_position;

select
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid, true) as trigger_definition,
  p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as function_owner,
  p.proconfig as function_settings,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = to_regclass('public.soul_trace_profiles')
  and t.tgname = 'sync_soul_trace_legacy_profile_trigger'
  and not t.tgisinternal;

select
  role_name,
  has_table_privilege(role_name, 'public.soul_trace_profiles', 'SELECT') as can_select,
  has_table_privilege(role_name, 'public.soul_trace_profiles', 'INSERT') as can_insert,
  has_table_privilege(role_name, 'public.soul_trace_profiles', 'UPDATE') as can_update,
  has_table_privilege(role_name, 'public.soul_trace_profiles', 'DELETE') as can_delete,
  has_table_privilege(role_name, 'public.soul_trace_profiles', 'TRUNCATE') as can_truncate
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name);

select
  case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
  acl.privilege_type,
  acl.is_grantable
from pg_class c
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
left join pg_roles grantee on grantee.oid = acl.grantee
where c.oid = to_regclass('public.soul_trace_profiles')
order by grantee, acl.privilege_type;

select
  i.indexrelid::regclass as index_name,
  i.indisunique as is_unique,
  i.indisvalid as is_valid,
  i.indnkeyatts as key_column_count,
  pg_get_indexdef(i.indexrelid) as index_definition
from pg_index i
where i.indrelid = to_regclass('public.soul_trace_legacy_links')
order by i.indexrelid::regclass::text;

-- Baseline counts for later comparison; no record-level identifiers are returned.
select 'pets' as entity, count(*) as row_count,
       count(*) filter (where owner_user_id is null) as unowned_count
from public.soul_trace_pets
union all
select 'profiles', count(*), null::bigint from public.soul_trace_profiles
union all
select 'submissions', count(*), null::bigint from public.soul_trace_submissions
union all
select 'legacy_links', count(*), null::bigint from public.soul_trace_legacy_links;

-- Assess whether enforcing a confirmed account for existing-letter updates
-- could affect old email-only records. Counts only; never returns email values.
select
  count(*) filter (where u.id is not null and u.email_confirmed_at is null)
    as profiles_matching_unconfirmed_auth_accounts,
  count(*) filter (where u.id is null)
    as profiles_without_matching_auth_account
from public.soul_trace_profiles p
left join auth.users u on lower(u.email) = lower(p.user_email);

-- Relationship anomalies that could make an existing-letter update unsafe.
select
  (select count(*) from public.soul_trace_legacy_links l
    left join public.soul_trace_profiles p on p.letter_id = l.letter_id
   where p.letter_id is null) as links_without_profile,
  (select count(*) from public.soul_trace_legacy_links l
    left join public.soul_trace_submissions s
      on s.submission_id = l.submission_id and s.letter_id = l.letter_id
   where s.submission_id is null) as links_without_matching_submission,
  (select count(*) from public.soul_trace_legacy_links l
    join public.soul_trace_submissions s on s.submission_id = l.submission_id
   where s.pet_id is distinct from l.pet_id) as submission_pet_mismatches,
  (select count(*) from public.soul_trace_legacy_links l
    join public.soul_trace_profiles p on p.letter_id = l.letter_id
   where p.pet_id is not null and p.pet_id is distinct from l.pet_id) as profile_pet_mismatches,
  (select count(*) from public.soul_trace_legacy_links l
    left join public.soul_trace_pets p on p.pet_id = l.pet_id
   where p.pet_id is null) as links_to_missing_pets,
  (select count(*) from (
    select pet_id from public.soul_trace_legacy_links group by pet_id having count(*) > 1
  ) repeated) as pets_with_multiple_letters;
