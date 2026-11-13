-- READ ONLY postflight checks for 20261106_003_seasonal_polaroid_pet_link.sql.
-- Capture the result-count query before and after applying the migration and
-- compare manually. No customer records are modified by this script.

select
  count(*) as all_polaroid_results,
  count(*) filter (where pet_id is null) as historical_or_unlinked_results,
  count(*) filter (where pet_id is not null) as pet_linked_results
from public.seasonal_polaroid_results;

select count(*) as invalid_pet_owner_links
from public.seasonal_polaroid_results as r
left join public.soul_trace_pets as p on p.pet_id = r.pet_id
where r.pet_id is not null
  and (p.pet_id is null or p.owner_user_id is distinct from r.owner_user_id);

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.seasonal_polaroid_results'::regclass
  and conname = 'seasonal_polaroid_results_pet_id_fkey';

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'seasonal_polaroid_results_owner_pet_created_idx';

select tgname, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid = 'public.seasonal_polaroid_results'::regclass
  and tgname = 'seasonal_polaroid_results_pet_owner_guard'
  and not tgisinternal;

select p.proname,
       p.prosecdef as security_definer,
       pg_get_userbyid(p.proowner) as function_owner,
       p.proconfig as function_settings,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('complete_seasonal_polaroid_job', 'enforce_seasonal_polaroid_pet_owner');

select has_table_privilege('authenticated', 'public.seasonal_polaroid_results', 'SELECT') as authenticated_can_select,
       has_table_privilege('service_role', 'public.seasonal_polaroid_results', 'SELECT') as service_role_can_select,
       has_table_privilege('service_role', 'public.seasonal_polaroid_results', 'INSERT') as service_role_can_insert;

select count(*) as unlinked_results_still_unlinked
from public.seasonal_polaroid_results
where pet_id is null;
