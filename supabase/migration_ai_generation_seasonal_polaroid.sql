-- Phase 3B-1: reserve the Seasonal Polaroid queue kind.
--
-- Prerequisites:
--   1. migration_ai_generation_safety.sql
--   2. migration_ai_generation_queue.sql
--
-- This is an additive migration. It does not create a second queue, change
-- existing rows, create result tables, or enable Seasonal generation. Apply it
-- only after verifying that the deployed queue schema matches the prerequisites.

do $$
declare
  table_name text;
  constraint_name text;
begin
  if to_regclass('public.ai_generation_jobs') is null
     or to_regclass('public.ai_rate_limit_events') is null then
    raise exception 'Seasonal Polaroid queue migration requires the AI generation safety schema';
  end if;

  -- The replacement RPC below is the queue-version contract, not the older
  -- safety-only contract. Fail before changing constraints when the queue
  -- extension has not been applied to this database.
  if (
    select count(*)
      from information_schema.columns AS cols
     where cols.table_schema = 'public'
       and cols.table_name = 'ai_generation_jobs'
       and cols.column_name in (
         'input_payload', 'input_storage_path', 'input_ready',
         'next_attempt_at', 'processing_started_at', 'last_error',
         'owner_identity_hash'
       )
  ) <> 7 then
    raise exception 'Seasonal Polaroid queue migration requires migration_ai_generation_queue.sql';
  end if;

  if to_regclass('storage.buckets') is null
     or not exists (
       select 1 from storage.buckets where id = 'ai-generation-inputs' and public = false
     ) then
    raise exception 'Seasonal Polaroid queue migration requires the private ai-generation-inputs bucket';
  end if;

  -- The original migrations used unnamed CHECK constraints. Remove only the
  -- generation-kind checks so this migration works with their generated names.
  for table_name, constraint_name in
    select t.relname, c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname in ('ai_generation_jobs', 'ai_rate_limit_events')
       and c.contype = 'c'
       -- pg_get_constraintdef may normalize IN to ANY, so identify the
       -- original kind-set checks by their column and legacy values rather
       -- than relying on the source spelling of the expression.
       and pg_get_constraintdef(c.oid) ~* 'generation_kind'
       and pg_get_constraintdef(c.oid) ~* 'letter'
       and pg_get_constraintdef(c.oid) ~* 'visual_memory'
  loop
    execute format(
      'alter table public.%I drop constraint %I',
      table_name,
      constraint_name
    );
  end loop;
end;
$$;

alter table public.ai_generation_jobs
  add constraint ai_generation_jobs_generation_kind_check
  check (generation_kind in ('letter', 'visual_memory', 'seasonal_polaroid'));

alter table public.ai_rate_limit_events
  add constraint ai_rate_limit_events_generation_kind_check
  check (generation_kind in ('letter', 'visual_memory', 'seasonal_polaroid'));

-- Keep the existing queue admission contract and behavior. The only behavior
-- change is accepting the additive generation kind above.
create or replace function public.acquire_ai_generation_job(
  p_idempotency_key text,
  p_request_hash text,
  p_generation_kind text,
  p_ip_hash text,
  p_identity_hash text,
  p_window_seconds integer,
  p_ip_limit integer,
  p_identity_limit integer,
  p_daily_window_seconds integer,
  p_ip_daily_limit integer,
  p_identity_daily_limit integer,
  p_global_limit integer,
  p_lease_seconds integer,
  p_success_reuse_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_job public.ai_generation_jobs%rowtype;
  recent_count bigint;
  active_count bigint;
  queued_count bigint;
  retry_after integer;
  next_status text;
begin
  if p_generation_kind not in ('letter', 'visual_memory', 'seasonal_polaroid')
     or p_window_seconds < 1 or p_ip_limit < 1 or p_global_limit < 1
     or p_daily_window_seconds < p_window_seconds or p_ip_daily_limit < p_ip_limit
     or p_lease_seconds < 1 or p_success_reuse_seconds < 1 then
    raise exception 'invalid ai generation guard configuration';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('soul-trace-ai-generation-admission', 0));

  select * into current_job
    from public.ai_generation_jobs
    where idempotency_key = p_idempotency_key
    for update;

  if found and current_job.request_hash <> p_request_hash then
    return jsonb_build_object('decision', 'conflict');
  end if;
  if found and current_job.status = 'succeeded'
     and current_job.updated_at > now() - make_interval(secs => p_success_reuse_seconds) then
    return jsonb_build_object('decision', 'succeeded', 'result', current_job.result, 'jobId', p_idempotency_key);
  end if;
  if found and current_job.status in ('queued', 'pending') then
    return jsonb_build_object('decision', 'queued', 'retryAfter', 5, 'jobId', p_idempotency_key);
  end if;
  if found and current_job.status = 'processing'
     and current_job.lease_expires_at > now() then
    retry_after := greatest(1, ceil(extract(epoch from current_job.lease_expires_at - now()))::integer);
    return jsonb_build_object('decision', 'processing', 'retryAfter', least(retry_after, 30), 'jobId', p_idempotency_key);
  end if;
  if found and current_job.status = 'processing' then
    update public.ai_generation_jobs
      set status = 'queued', lease_expires_at = null, next_attempt_at = now(),
          updated_at = now(), last_error = 'stale_processing_recovered'
      where idempotency_key = p_idempotency_key;
    return jsonb_build_object('decision', 'queued', 'retryAfter', 5, 'jobId', p_idempotency_key);
  end if;

  -- Abuse checks remain before capacity checks. Queuing never bypasses them.
  select count(*) into recent_count
    from public.ai_rate_limit_events
    where generation_kind = p_generation_kind
      and subject_type = 'ip' and subject_hash = p_ip_hash
      and created_at > now() - make_interval(secs => p_window_seconds);
  if recent_count >= p_ip_limit then
    return jsonb_build_object('decision', 'rate_limited', 'retryAfter', p_window_seconds);
  end if;

  select count(*) into recent_count
    from public.ai_rate_limit_events
    where generation_kind = p_generation_kind
      and subject_type = 'ip' and subject_hash = p_ip_hash
      and created_at > now() - make_interval(secs => p_daily_window_seconds);
  if recent_count >= p_ip_daily_limit then
    return jsonb_build_object('decision', 'rate_limited', 'retryAfter', p_daily_window_seconds);
  end if;

  if p_identity_hash is not null and p_identity_limit > 0 then
    select count(*) into recent_count
      from public.ai_rate_limit_events
      where generation_kind = p_generation_kind
        and subject_type = 'identity' and subject_hash = p_identity_hash
        and created_at > now() - make_interval(secs => p_window_seconds);
    if recent_count >= p_identity_limit then
      return jsonb_build_object('decision', 'rate_limited', 'retryAfter', p_window_seconds);
    end if;
    select count(*) into recent_count
      from public.ai_rate_limit_events
      where generation_kind = p_generation_kind
        and subject_type = 'identity' and subject_hash = p_identity_hash
        and created_at > now() - make_interval(secs => p_daily_window_seconds);
    if p_identity_daily_limit > 0 and recent_count >= p_identity_daily_limit then
      return jsonb_build_object('decision', 'rate_limited', 'retryAfter', p_daily_window_seconds);
    end if;
  end if;

  select count(*) into active_count
    from public.ai_generation_jobs
    where status = 'processing' and lease_expires_at > now();
  select count(*) into queued_count
    from public.ai_generation_jobs
    where status = 'queued';
  next_status := case when active_count < p_global_limit and queued_count = 0 then 'processing' else 'queued' end;

  insert into public.ai_rate_limit_events(generation_kind, subject_type, subject_hash)
    values (p_generation_kind, 'ip', p_ip_hash);
  if p_identity_hash is not null and p_identity_limit > 0 then
    insert into public.ai_rate_limit_events(generation_kind, subject_type, subject_hash)
      values (p_generation_kind, 'identity', p_identity_hash);
  end if;

  insert into public.ai_generation_jobs(
    idempotency_key, request_hash, generation_kind, status, attempt_count,
    lease_expires_at, next_attempt_at, input_ready
  ) values (
    p_idempotency_key, p_request_hash, p_generation_kind, next_status, 1,
    case when next_status = 'processing' then now() + make_interval(secs => p_lease_seconds) else null end,
    case when next_status = 'queued' then now() else null end,
    false
  )
  on conflict (idempotency_key) do update set
    status = excluded.status, result = null, error_code = null,
    attempt_count = public.ai_generation_jobs.attempt_count + 1,
    lease_expires_at = excluded.lease_expires_at,
    next_attempt_at = excluded.next_attempt_at,
    input_ready = false,
    updated_at = now(), completed_at = null, last_error = null;

  return jsonb_build_object(
    'decision', case when next_status = 'processing' then 'acquired' else 'queued' end,
    'retryAfter', case when next_status = 'processing' then 1 else 5 end,
    'jobId', p_idempotency_key
  );
end;
$$;

-- Keep service-role-only queue permissions unchanged after replacing the RPC.
revoke all on function public.acquire_ai_generation_job(text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.acquire_ai_generation_job(text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer) to service_role;
