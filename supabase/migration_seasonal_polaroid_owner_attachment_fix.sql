-- Corrective patch for an already-installed Seasonal durable-persistence
-- migration. It makes owner attachment establish the queue hash atomically
-- before set_ai_generation_input marks a job input-ready.
-- Apply only after migration_seasonal_polaroid_durable_persistence.sql.

begin;

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

revoke all on function public.attach_seasonal_polaroid_job_owner(text, uuid, text) from public, anon, authenticated;
grant execute on function public.attach_seasonal_polaroid_job_owner(text, uuid, text) to service_role;

commit;
