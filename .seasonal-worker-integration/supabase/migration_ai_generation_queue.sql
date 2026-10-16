-- Phase 1 queue extension. Apply after migration_ai_generation_safety.sql.
-- This migration is intentionally separate so an already-applied safety migration
-- is never rewritten in place.

alter table public.ai_generation_jobs
  drop constraint if exists ai_generation_jobs_status_check;
alter table public.ai_generation_jobs
  add constraint ai_generation_jobs_status_check
  check (status in ('pending', 'queued', 'processing', 'succeeded', 'failed'));

alter table public.ai_generation_jobs
  add column if not exists input_payload jsonb,
  add column if not exists input_storage_path text,
  add column if not exists input_ready boolean not null default false,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists last_error text,
  add column if not exists owner_identity_hash text;

create index if not exists ai_generation_jobs_queue_idx
  on public.ai_generation_jobs (status, input_ready, next_attempt_at, created_at)
  where status in ('queued', 'processing');

-- Reference images for queued Visual Memory jobs are private objects. The service
-- role is the only application principal that reads or writes this bucket.
insert into storage.buckets (id, name, public)
values ('ai-generation-inputs', 'ai-generation-inputs', false)
on conflict (id) do nothing;

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
  if p_generation_kind not in ('letter', 'visual_memory')
     or p_window_seconds < 1 or p_ip_limit < 1 or p_global_limit < 1
     or p_daily_window_seconds < p_window_seconds or p_ip_daily_limit < p_ip_limit
     or p_lease_seconds < 1 or p_success_reuse_seconds < 1 then
    raise exception 'invalid ai generation guard configuration';
  end if;

  -- Serialize capacity admission across Vercel instances.
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
    -- This is the same logical request, not a new admission. Do not charge a
    -- second rate-limit event while returning it to the durable queue.
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
  -- Once a queue exists, new work joins its tail instead of bypassing older
  -- requests that are waiting for the next worker claim.
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

create or replace function public.set_ai_generation_input(
  p_idempotency_key text,
  p_request_hash text,
  p_input_payload jsonb,
  p_input_storage_path text,
  p_owner_identity_hash text
) returns boolean
language sql
security definer
set search_path = public
as $$
  update public.ai_generation_jobs
    set input_payload = p_input_payload,
        input_storage_path = p_input_storage_path,
        owner_identity_hash = coalesce(p_owner_identity_hash, owner_identity_hash),
        input_ready = true,
        updated_at = now()
    where idempotency_key = p_idempotency_key
      and request_hash = p_request_hash
      and status in ('queued', 'processing')
  returning true;
$$;

create or replace function public.claim_ai_generation_jobs(
  p_limit integer,
  p_lease_seconds integer
) returns setof public.ai_generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_job public.ai_generation_jobs%rowtype;
  active_count integer;
  available_count integer;
begin
  if p_limit < 1 or p_lease_seconds < 1 then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('soul-trace-ai-generation-admission', 0));

  -- A terminated Vercel invocation cannot heartbeat. Return bounded stale work
  -- to the FIFO queue, or fail it after the retry budget is exhausted.
  update public.ai_generation_jobs
    set status = case when input_ready = false or attempt_count >= 3 then 'failed' else 'queued' end,
        lease_expires_at = null,
        next_attempt_at = case when input_ready = false or attempt_count >= 3 then null else now() end,
        error_code = case when input_ready = false then 'missing_input' when attempt_count >= 3 then 'worker_timeout' else error_code end,
        last_error = 'stale_processing_recovered',
        updated_at = now(), completed_at = case when input_ready = false or attempt_count >= 3 then now() else null end
    where status = 'processing' and lease_expires_at is not null and lease_expires_at <= now();

  update public.ai_generation_jobs
    set status = 'failed', error_code = 'missing_input', last_error = 'queued_input_never_attached',
        updated_at = now(), completed_at = now()
    where status = 'queued' and input_ready = false
      and updated_at < now() - interval '5 minutes';

  select count(*)::integer into active_count
    from public.ai_generation_jobs
    where status = 'processing' and lease_expires_at > now();
  available_count := greatest(0, p_limit - active_count);
  if available_count = 0 then
    return;
  end if;

  for current_job in
    select * from public.ai_generation_jobs
      where status = 'queued'
        and input_ready = true
        and coalesce(next_attempt_at, created_at) <= now()
      order by created_at asc
      for update skip locked
      limit available_count
  loop
    update public.ai_generation_jobs
      set status = 'processing',
          attempt_count = attempt_count + 1,
          lease_expires_at = now() + make_interval(secs => p_lease_seconds),
          processing_started_at = now(),
          updated_at = now()
      where idempotency_key = current_job.idempotency_key;
    select * into current_job from public.ai_generation_jobs
      where idempotency_key = current_job.idempotency_key;
    return next current_job;
  end loop;
end;
$$;

create or replace function public.requeue_ai_generation_job(
  p_idempotency_key text,
  p_error_code text,
  p_max_attempts integer default 3
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_attempt integer;
begin
  select attempt_count into current_attempt
    from public.ai_generation_jobs
    where idempotency_key = p_idempotency_key
    for update;
  if not found then return false; end if;
  if current_attempt >= p_max_attempts then
    update public.ai_generation_jobs
      set status = 'failed', error_code = left(p_error_code, 100), last_error = left(p_error_code, 500),
          lease_expires_at = null, next_attempt_at = null, updated_at = now(), completed_at = now()
      where idempotency_key = p_idempotency_key and status in ('processing', 'failed');
  else
    update public.ai_generation_jobs
      set status = 'queued', error_code = null, last_error = left(p_error_code, 500),
          lease_expires_at = null,
          next_attempt_at = now() + make_interval(secs => least(300, 15 * (2 ^ greatest(current_attempt - 1, 0)))),
          updated_at = now()
      where idempotency_key = p_idempotency_key and status in ('processing', 'failed');
  end if;
  return found;
end;
$$;

create or replace function public.complete_ai_generation_job(
  p_idempotency_key text,
  p_request_hash text,
  p_result jsonb
) returns boolean
language sql
security definer
set search_path = public
as $$
  update public.ai_generation_jobs
    set status = 'succeeded', result = p_result, error_code = null,
        lease_expires_at = null, next_attempt_at = null, updated_at = now(), completed_at = now()
    where idempotency_key = p_idempotency_key
      and request_hash = p_request_hash and status in ('pending', 'processing')
  returning true;
$$;

create or replace function public.fail_ai_generation_job(
  p_idempotency_key text,
  p_request_hash text,
  p_error_code text
) returns boolean
language sql
security definer
set search_path = public
as $$
  update public.ai_generation_jobs
    set status = 'failed', result = null, error_code = left(p_error_code, 100),
        lease_expires_at = null, next_attempt_at = null, updated_at = now(), completed_at = now()
    where idempotency_key = p_idempotency_key
      and request_hash = p_request_hash and status in ('pending', 'processing')
  returning true;
$$;

revoke all on function public.set_ai_generation_input(text,text,jsonb,text,text) from public, anon, authenticated;
revoke all on function public.claim_ai_generation_jobs(integer,integer) from public, anon, authenticated;
revoke all on function public.requeue_ai_generation_job(text,text,integer) from public, anon, authenticated;
grant execute on function public.set_ai_generation_input(text,text,jsonb,text,text) to service_role;
grant execute on function public.claim_ai_generation_jobs(integer,integer) to service_role;
grant execute on function public.requeue_ai_generation_job(text,text,integer) to service_role;

-- Queue objects are operational data. Retain the existing daily cleanup and also
-- remove old private input objects with a separate Storage lifecycle policy.
