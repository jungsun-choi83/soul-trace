-- Pet-First links for newly generated Seasonal Polaroids.
-- Additive only: existing results keep pet_id NULL and remain in My Polaroids.
-- Apply only after review and after the application release is ready.
begin;

do $$
begin
  if to_regclass('public.seasonal_polaroid_results') is null then
    raise exception 'Pet-linked Polaroids require public.seasonal_polaroid_results';
  end if;

  if to_regclass('public.soul_trace_pets') is null then
    raise exception 'Pet-linked Polaroids require public.soul_trace_pets';
  end if;
  if to_regclass('public.ai_generation_jobs') is null then
    raise exception 'Pet-linked Polaroids require public.ai_generation_jobs';
  end if;
  if to_regclass('public.seasonal_polaroid_job_owners') is null then
    raise exception 'Pet-linked Polaroids require the durable Seasonal owner registry';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ai_generation_jobs'
       and column_name = 'input_payload'
  ) then
    raise exception 'ai_generation_jobs.input_payload is required to bind Pet ID through queue retries';
  end if;
  if to_regprocedure('public.complete_seasonal_polaroid_job(text,text,jsonb)') is null then
    raise exception 'The durable Seasonal completion RPC must exist before adding Pet links';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'soul_trace_pets'
       and column_name = 'pet_id' and data_type = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'soul_trace_pets'
       and column_name = 'owner_user_id' and data_type = 'uuid'
  ) then
    raise exception 'soul_trace_pets must expose UUID pet_id and owner_user_id';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'seasonal_polaroid_results'
       and column_name = 'owner_user_id' and data_type = 'uuid'
  ) then
    raise exception 'seasonal_polaroid_results.owner_user_id must be UUID';
  end if;
end;
$$;

alter table public.seasonal_polaroid_results
  add column if not exists pet_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.seasonal_polaroid_results'::regclass
       and conname = 'seasonal_polaroid_results_pet_id_fkey'
  ) then
    alter table public.seasonal_polaroid_results
      add constraint seasonal_polaroid_results_pet_id_fkey
      foreign key (pet_id) references public.soul_trace_pets(pet_id)
      on delete set null;
  end if;
end;
$$;

create index if not exists seasonal_polaroid_results_owner_pet_created_idx
  on public.seasonal_polaroid_results (owner_user_id, pet_id, created_at desc)
  where pet_id is not null;

-- The FK proves that a pet exists. This trigger also proves that the result's
-- account owner is that pet's owner; NULL remains valid for legacy/guest rows.
create or replace function public.enforce_seasonal_polaroid_pet_owner()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  canonical_owner uuid;
begin
  if new.pet_id is null then
    return new;
  end if;

  select p.owner_user_id
    into canonical_owner
    from public.soul_trace_pets as p
   where p.pet_id = new.pet_id;

  if not found or canonical_owner is distinct from new.owner_user_id then
    raise exception 'Polaroid pet does not belong to result owner'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists seasonal_polaroid_results_pet_owner_guard
  on public.seasonal_polaroid_results;
create trigger seasonal_polaroid_results_pet_owner_guard
before insert or update of pet_id, owner_user_id
on public.seasonal_polaroid_results
for each row execute function public.enforce_seasonal_polaroid_pet_owner();

-- Preserve the existing SECURITY DEFINER service-role RPC and its grants while
-- extending the same transaction to validate and persist the selected Pet ID.
create or replace function public.complete_seasonal_polaroid_job(
  p_idempotency_key text,
  p_request_hash text,
  p_result jsonb
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  job_row public.ai_generation_jobs%rowtype;
  owner_row public.seasonal_polaroid_job_owners%rowtype;
  existing_result public.seasonal_polaroid_results%rowtype;
  result_id_text text;
  result_uuid uuid;
  changed integer;
  image_key text;
  memo_locale text;
  pet_status text;
  memo_lines jsonb;
  result_pet_id_text text;
  queue_pet_id_text text;
  result_pet_id uuid;
  canonical_owner uuid;
  owner_mapping_found boolean;
begin
  select * into job_row
    from public.ai_generation_jobs
   where idempotency_key = p_idempotency_key
     and request_hash = p_request_hash
   for update;
  if not found or job_row.generation_kind <> 'seasonal_polaroid' then
    return false;
  end if;

  result_id_text := p_result->>'resultId';
  image_key := p_result #>> '{image,objectKey}';
  memo_locale := p_result #>> '{memo,locale}';
  pet_status := p_result #>> '{pet,status}';
  memo_lines := p_result #> '{memo,lines}';
  result_pet_id_text := nullif(p_result->>'petId', '');
  queue_pet_id_text := nullif(job_row.input_payload #>> '{petId}', '');
  if result_id_text is null or result_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or image_key is null
     or image_key !~ '^seasonal-polaroid/[0-9a-f]{64}/result/[A-Za-z0-9_-]{16,64}[.]jpg$'
     or split_part(image_key, '/', 2) is distinct from p_idempotency_key
     or memo_locale is null
     or memo_locale not in ('en', 'ko')
     or pet_status is null
     or pet_status not in ('living', 'passed')
     or result_pet_id_text is distinct from queue_pet_id_text
     or (result_pet_id_text is not null and result_pet_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    return false;
  end if;
  if memo_lines is null or jsonb_typeof(memo_lines) is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(memo_lines) <> 4 then
    return false;
  end if;
  result_uuid := result_id_text::uuid;
  if result_pet_id_text is not null then
    result_pet_id := result_pet_id_text::uuid;
  end if;

  select * into owner_row
    from public.seasonal_polaroid_job_owners
   where job_id = p_idempotency_key
   for update;
  owner_mapping_found := found;

  if result_pet_id is not null then
    if not owner_mapping_found then
      return false;
    end if;
    select p.owner_user_id into canonical_owner
      from public.soul_trace_pets as p
     where p.pet_id = result_pet_id;
    if not found or canonical_owner is distinct from owner_row.owner_user_id then
      return false;
    end if;
  end if;

  -- A succeeded retry is valid only for the same immutable pet association.
  if job_row.status = 'succeeded' then
    if owner_mapping_found then
      select * into existing_result
        from public.seasonal_polaroid_results
       where result_id = result_uuid
       for update;
      if not found
         or existing_result.job_id <> p_idempotency_key
         or existing_result.owner_user_id <> owner_row.owner_user_id
         or existing_result.pet_id is distinct from result_pet_id
         or existing_result.image_object_key <> image_key then
        return false;
      end if;
      return true;
    end if;
    if job_row.owner_identity_hash is not null
       or job_row.result is null
       or job_row.result->>'resultId' <> result_id_text
       or job_row.result #>> '{image,objectKey}' <> image_key
       or nullif(job_row.result->>'petId', '') is not null then
      return false;
    end if;
    return true;
  end if;

  if job_row.status not in ('pending', 'processing') then
    return false;
  end if;
  if not owner_mapping_found and job_row.owner_identity_hash is not null then
    return false;
  end if;
  if owner_mapping_found and owner_row.owner_identity_hash <> job_row.owner_identity_hash then
    return false;
  end if;

  if owner_mapping_found then
    select * into existing_result
      from public.seasonal_polaroid_results
     where result_id = result_uuid
     for update;
    if found then
      if existing_result.job_id <> p_idempotency_key
         or existing_result.owner_user_id <> owner_row.owner_user_id
         or existing_result.pet_id is distinct from result_pet_id
         or existing_result.image_object_key <> image_key then
        return false;
      end if;
    else
      insert into public.seasonal_polaroid_results(
        result_id, job_id, owner_user_id, pet_id, pet_name, species, status,
        theme_id, costume_id, image_object_key,
        memo_line_1, memo_line_2, memo_line_3, memo_line_4,
        memo_locale, generation_metadata
      ) values (
        result_uuid, p_idempotency_key, owner_row.owner_user_id, result_pet_id,
        coalesce(p_result #>> '{pet,name}', ''),
        coalesce(p_result #>> '{pet,species}', ''), pet_status,
        coalesce(p_result->>'themeId', 'halloween'),
        coalesce(p_result->>'costumeId', ''), image_key,
        p_result #>> '{memo,lines,0}', p_result #>> '{memo,lines,1}',
        p_result #>> '{memo,lines,2}', p_result #>> '{memo,lines,3}',
        memo_locale, coalesce(p_result->'generation', '{}'::jsonb)
      ) on conflict (result_id) do nothing;

      select * into existing_result
        from public.seasonal_polaroid_results
       where result_id = result_uuid
       for update;
      if not found
         or existing_result.job_id <> p_idempotency_key
         or existing_result.owner_user_id <> owner_row.owner_user_id
         or existing_result.pet_id is distinct from result_pet_id
         or existing_result.image_object_key <> image_key then
        raise exception 'seasonal result identity conflict';
      end if;
    end if;
  elsif result_pet_id is not null then
    return false;
  end if;

  update public.ai_generation_jobs
     set status = 'succeeded', result = p_result, error_code = null,
         lease_expires_at = null, next_attempt_at = null,
         updated_at = now(), completed_at = now()
   where idempotency_key = p_idempotency_key
     and request_hash = p_request_hash
     and status in ('pending', 'processing');
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'seasonal completion state changed before commit';
  end if;
  return true;
end;
$$;

-- Existing function ownership and EXECUTE grants are retained by CREATE OR REPLACE.
-- Read-only postflight checks:
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_schema='public' and table_name='seasonal_polaroid_results' and column_name='pet_id';
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid='public.seasonal_polaroid_results'::regclass and conname='seasonal_polaroid_results_pet_id_fkey';
-- select indexname, indexdef from pg_indexes where schemaname='public' and indexname='seasonal_polaroid_results_owner_pet_created_idx';
-- select tgname from pg_trigger where tgrelid='public.seasonal_polaroid_results'::regclass and not tgisinternal;
-- select p.proname, p.prosecdef, pg_get_userbyid(p.proowner) as owner, p.proconfig
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.proname='complete_seasonal_polaroid_job';
-- select has_function_privilege('service_role','public.complete_seasonal_polaroid_job(text,text,jsonb)','EXECUTE');

commit;
