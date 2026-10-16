-- Durable Seasonal Polaroid ownership and completion persistence.
-- Additive only; review and apply after the existing queue, owner, and
-- seasonal_polaroid_results migrations, before enabling new Seasonal jobs.
-- Letter and Visual Memory queue rows do not use this table or these RPCs.

begin;

do $$
begin
  if to_regclass('public.ai_generation_jobs') is null then
    raise exception 'Seasonal durable persistence requires public.ai_generation_jobs';
  end if;
  if to_regclass('public.soul_trace_owners') is null then
    raise exception 'Seasonal durable persistence requires public.soul_trace_owners';
  end if;
  if to_regclass('public.seasonal_polaroid_results') is null then
    raise exception 'Seasonal durable persistence requires public.seasonal_polaroid_results';
  end if;
end;
$$;

create table if not exists public.seasonal_polaroid_job_owners (
  job_id text primary key
    references public.ai_generation_jobs(idempotency_key) on delete cascade,
  owner_user_id uuid not null
    references public.soul_trace_owners(user_id) on delete cascade,
  owner_identity_hash text not null check (owner_identity_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists seasonal_polaroid_job_owners_user_idx
  on public.seasonal_polaroid_job_owners(owner_user_id, created_at desc);

alter table public.seasonal_polaroid_job_owners enable row level security;
revoke all on table public.seasonal_polaroid_job_owners from public, anon, authenticated;
grant select, insert, delete on table public.seasonal_polaroid_job_owners to service_role;

create or replace function public.attach_seasonal_polaroid_job_owner(
  p_job_id text,
  p_owner_user_id uuid,
  p_owner_identity_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.ai_generation_jobs%rowtype;
  changed integer;
  existing_owner public.seasonal_polaroid_job_owners%rowtype;
begin
  if p_job_id is null or p_job_id !~ '^[0-9a-f]{64}$'
     or p_owner_user_id is null
     or p_owner_identity_hash is null
     or p_owner_identity_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  -- Lock and validate the queue row before changing either ownership table.
  -- Newly admitted rows have not reached set_ai_generation_input yet, so the
  -- queue hash is legitimately NULL at this point. Establish it here while
  -- the row is locked; set_ai_generation_input will then accept the same hash.
  select * into job_row
    from public.ai_generation_jobs
   where idempotency_key = p_job_id
     and generation_kind = 'seasonal_polaroid'
   for update;
  if not found or job_row.status not in ('queued', 'processing') then
    return false;
  end if;

  if job_row.owner_identity_hash is not null
     and job_row.owner_identity_hash <> p_owner_identity_hash then
    return false;
  end if;

  select * into existing_owner
    from public.seasonal_polaroid_job_owners
   where job_id = p_job_id
   for update;
  if found and (existing_owner.owner_user_id <> p_owner_user_id
                or existing_owner.owner_identity_hash <> p_owner_identity_hash) then
    return false;
  end if;

  update public.ai_generation_jobs
     set owner_identity_hash = p_owner_identity_hash,
         updated_at = now()
   where idempotency_key = p_job_id
     and generation_kind = 'seasonal_polaroid'
     and status in ('queued', 'processing')
     and (owner_identity_hash is null or owner_identity_hash = p_owner_identity_hash);
  if not found then
    return false;
  end if;

  -- OTP verification proves the auth.users identity, but a newly verified
  -- account may not yet have a row in this application's owner registry. The
  -- trusted server creates that registry row in the same transaction as the
  -- job association so the gallery FK can never make a valid job fail merely
  -- because the user has not downloaded or saved anything before.
  insert into public.soul_trace_owners(user_id)
  values (p_owner_user_id)
  on conflict (user_id) do nothing;

  insert into public.seasonal_polaroid_job_owners(job_id, owner_user_id, owner_identity_hash)
  values (p_job_id, p_owner_user_id, p_owner_identity_hash)
  on conflict (job_id) do update
    set owner_user_id = excluded.owner_user_id,
        owner_identity_hash = excluded.owner_identity_hash
  where public.seasonal_polaroid_job_owners.owner_user_id = excluded.owner_user_id
    and public.seasonal_polaroid_job_owners.owner_identity_hash = excluded.owner_identity_hash;

  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'seasonal owner association changed before commit';
  end if;
  return true;
end;
$$;

create or replace function public.complete_seasonal_polaroid_job(
  p_idempotency_key text,
  p_request_hash text,
  p_result jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
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
  if result_id_text is null or result_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or image_key is null
     or image_key !~ '^seasonal-polaroid/[0-9a-f]{64}/result/[A-Za-z0-9_-]{16,64}[.]jpg$'
     or split_part(image_key, '/', 2) is distinct from p_idempotency_key
     or memo_locale is null
     or memo_locale not in ('en', 'ko')
     or pet_status is null
     or pet_status not in ('living', 'passed') then
    return false;
  end if;
  if memo_lines is null or jsonb_typeof(memo_lines) is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(memo_lines) <> 4 then
    return false;
  end if;
  result_uuid := result_id_text::uuid;

  select * into owner_row
    from public.seasonal_polaroid_job_owners
   where job_id = p_idempotency_key
   for update;

  -- Resolve terminal states before touching the gallery. The queue row is
  -- locked above, so a late completion after failure cannot create a result.
  -- A succeeded retry is idempotent only when the already-committed result
  -- belongs to this exact job and owner (or is the intentionally unowned
  -- developer result recorded on the queue row).
  if job_row.status = 'succeeded' then
    if found then
      select * into existing_result
        from public.seasonal_polaroid_results
       where result_id = result_uuid
       for update;
      if not found
         or existing_result.job_id <> p_idempotency_key
         or existing_result.owner_user_id <> owner_row.owner_user_id
         or existing_result.image_object_key <> image_key then
        return false;
      end if;
      return true;
    end if;

    if job_row.owner_identity_hash is not null
       or job_row.result is null
       or job_row.result->>'resultId' <> result_id_text
       or job_row.result #>> '{image,objectKey}' <> image_key then
      return false;
    end if;
    return true;
  end if;

  -- Only an active queue job may create a new durable result. Failed, queued,
  -- and otherwise terminal rows have no write side effects.
  if job_row.status not in ('pending', 'processing') then
    return false;
  end if;

  -- Developer-only local jobs deliberately have no owner identity and are not
  -- account records. Authenticated jobs must have the mapping before they can
  -- become succeeded.
  if not found and job_row.owner_identity_hash is not null then
    return false;
  end if;
  if found and owner_row.owner_identity_hash <> job_row.owner_identity_hash then
    return false;
  end if;

  if found then
    select * into existing_result
      from public.seasonal_polaroid_results
     where result_id = result_uuid
     for update;
    if found then
      if existing_result.job_id <> p_idempotency_key
         or existing_result.owner_user_id <> owner_row.owner_user_id
         or existing_result.image_object_key <> image_key then
        return false;
      end if;
    else
      insert into public.seasonal_polaroid_results(
      result_id, job_id, owner_user_id, pet_name, species, status,
      theme_id, costume_id, image_object_key,
      memo_line_1, memo_line_2, memo_line_3, memo_line_4,
      memo_locale, generation_metadata
    ) values (
      result_uuid, p_idempotency_key, owner_row.owner_user_id,
      coalesce(p_result #>> '{pet,name}', ''),
      coalesce(p_result #>> '{pet,species}', ''),
      pet_status,
      coalesce(p_result->>'themeId', 'halloween'),
      coalesce(p_result->>'costumeId', ''),
      image_key,
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
         or existing_result.image_object_key <> image_key then
        -- A conflict with a different job must not leave a partial completion.
        raise exception 'seasonal result identity conflict';
      end if;
    end if;
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
    -- Do not return false after a gallery insert. Raising rolls back the
    -- entire RPC transaction and keeps queue/result state consistent.
    raise exception 'seasonal completion state changed before commit';
  end if;
  return true;
end;
$$;

revoke all on function public.attach_seasonal_polaroid_job_owner(text, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_seasonal_polaroid_job(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.attach_seasonal_polaroid_job_owner(text, uuid, text) to service_role;
grant execute on function public.complete_seasonal_polaroid_job(text, text, jsonb) to service_role;

-- Read-only verification after applying:
-- select to_regclass('public.seasonal_polaroid_job_owners');
-- select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('attach_seasonal_polaroid_job_owner', 'complete_seasonal_polaroid_job');

commit;
