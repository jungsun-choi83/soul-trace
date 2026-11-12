-- READ ONLY postflight for 20261106_002_pet_first_letter_persistence.sql.
-- Compare aggregate counts to the saved preflight output. The migration must
-- not change customer rows; this script returns no direct identifiers/content.

select
  p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as function_owner,
  p.proconfig as function_settings,
  (p.prosrc like '%selected_pet_does_not_belong_to_confirmed_account%') as rejects_foreign_selected_pet,
  (p.prosrc like '%existing_letter_pet_reassociation_rejected%') as rejects_existing_letter_reassociation,
  (p.prosrc like '%letter_pet_id_cannot_be_cleared%') as rejects_clearing_existing_pet_id,
  (p.prosrc not like '%set pet_name = new.pet_name%') as does_not_overwrite_canonical_pet_name,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
where p.oid = to_regprocedure('public.sync_soul_trace_legacy_profile()');

select pg_get_triggerdef(t.oid, true) as profile_trigger_definition,
       (pg_get_triggerdef(t.oid, true) like '%pet_id%') as fires_for_pet_id,
       (pg_get_triggerdef(t.oid, true) like '%user_email%') as fires_for_user_email
from pg_trigger t
where t.tgrelid = to_regclass('public.soul_trace_profiles')
  and t.tgname = 'sync_soul_trace_legacy_profile_trigger'
  and not t.tgisinternal;

select
  has_table_privilege('service_role', 'public.soul_trace_profiles', 'SELECT') as service_select,
  has_table_privilege('service_role', 'public.soul_trace_profiles', 'INSERT') as service_insert,
  has_table_privilege('service_role', 'public.soul_trace_profiles', 'UPDATE') as service_update,
  has_table_privilege('anon', 'public.soul_trace_profiles', 'INSERT') as anon_insert,
  has_table_privilege('anon', 'public.soul_trace_profiles', 'UPDATE') as anon_update,
  has_table_privilege('anon', 'public.soul_trace_profiles', 'DELETE') as anon_delete,
  has_table_privilege('authenticated', 'public.soul_trace_profiles', 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', 'public.soul_trace_profiles', 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', 'public.soul_trace_profiles', 'DELETE') as authenticated_delete;

select 'pets' as entity, count(*) as row_count,
       count(*) filter (where owner_user_id is null) as unowned_count
from public.soul_trace_pets
union all
select 'profiles', count(*), null::bigint from public.soul_trace_profiles
union all
select 'submissions', count(*), null::bigint from public.soul_trace_submissions
union all
select 'legacy_links', count(*), null::bigint from public.soul_trace_legacy_links;

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
