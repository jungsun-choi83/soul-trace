-- Additive Phase 3 rate-limit diagnostics.
-- Apply after migration_ai_generation_seasonal_polaroid.sql.
-- This replaces only the existing queue-admission function body. It preserves
-- the generation kinds, idempotency, queueing, leases, and service-role grant.
-- It changes rate-limit retryAfter from a fixed window to the actual time until
-- enough events exit each exhausted rolling window.
-- Apply only after verifying the deployed function has this exact 14-argument
-- signature. The Seasonal queue migration must already have expanded the
-- generation-kind constraints; no overload is created here.

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
  oldest_event timestamptz;
  active_count bigint;
  queued_count bigint;
  retry_after integer;
  short_retry_after integer := 0;
  daily_retry_after integer := 0;
  next_status text;
begin
  if p_generation_kind not in ('letter', 'visual_memory', 'seasonal_polaroid')
     or p_window_seconds < 1 or p_ip_limit < 1 or p_global_limit < 1
     or p_identity_limit < 0 or p_identity_daily_limit < 0
     or p_daily_window_seconds < p_window_seconds or p_ip_daily_limit < p_ip_limit
     or (p_identity_limit > 0 and p_identity_daily_limit > 0 and p_identity_daily_limit < p_identity_limit)
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

  -- Count events and calculate the exact time until enough events expire to
  -- fall strictly below the configured limit. When a limit has been lowered
  -- after events were recorded, this intentionally skips the first
  -- (count - limit) oldest events rather than waiting for only the oldest.
  -- The larger wait wins when multiple rolling limits are exhausted.
  select count(*) into recent_count
    from public.ai_rate_limit_events
    where generation_kind = p_generation_kind
      and subject_type = 'ip' and subject_hash = p_ip_hash
      and created_at > now() - make_interval(secs => p_window_seconds);
  if recent_count >= p_ip_limit then
    select created_at into oldest_event
      from public.ai_rate_limit_events
     where generation_kind = p_generation_kind
       and subject_type = 'ip' and subject_hash = p_ip_hash
       and created_at > now() - make_interval(secs => p_window_seconds)
     order by created_at asc
     offset (recent_count - p_ip_limit)
     limit 1;
    short_retry_after := greatest(1, ceil(extract(epoch from oldest_event + make_interval(secs => p_window_seconds) - now()))::integer);
  end if;

  select count(*) into recent_count
    from public.ai_rate_limit_events
    where generation_kind = p_generation_kind
      and subject_type = 'ip' and subject_hash = p_ip_hash
      and created_at > now() - make_interval(secs => p_daily_window_seconds);
  if recent_count >= p_ip_daily_limit then
    select created_at into oldest_event
      from public.ai_rate_limit_events
     where generation_kind = p_generation_kind
       and subject_type = 'ip' and subject_hash = p_ip_hash
       and created_at > now() - make_interval(secs => p_daily_window_seconds)
     order by created_at asc
     offset (recent_count - p_ip_daily_limit)
     limit 1;
    daily_retry_after := greatest(1, ceil(extract(epoch from oldest_event + make_interval(secs => p_daily_window_seconds) - now()))::integer);
  end if;

  if p_identity_hash is not null and p_identity_limit > 0 then
    select count(*) into recent_count
      from public.ai_rate_limit_events
      where generation_kind = p_generation_kind
        and subject_type = 'identity' and subject_hash = p_identity_hash
        and created_at > now() - make_interval(secs => p_window_seconds);
    if recent_count >= p_identity_limit then
      select created_at into oldest_event
        from public.ai_rate_limit_events
       where generation_kind = p_generation_kind
         and subject_type = 'identity' and subject_hash = p_identity_hash
         and created_at > now() - make_interval(secs => p_window_seconds)
       order by created_at asc
       offset (recent_count - p_identity_limit)
       limit 1;
      short_retry_after := greatest(short_retry_after, greatest(1, ceil(extract(epoch from oldest_event + make_interval(secs => p_window_seconds) - now()))::integer));
    end if;

    select count(*) into recent_count
      from public.ai_rate_limit_events
      where generation_kind = p_generation_kind
        and subject_type = 'identity' and subject_hash = p_identity_hash
        and created_at > now() - make_interval(secs => p_daily_window_seconds);
    if p_identity_daily_limit > 0 and recent_count >= p_identity_daily_limit then
      select created_at into oldest_event
        from public.ai_rate_limit_events
       where generation_kind = p_generation_kind
         and subject_type = 'identity' and subject_hash = p_identity_hash
         and created_at > now() - make_interval(secs => p_daily_window_seconds)
       order by created_at asc
       offset (recent_count - p_identity_daily_limit)
       limit 1;
      daily_retry_after := greatest(daily_retry_after, greatest(1, ceil(extract(epoch from oldest_event + make_interval(secs => p_daily_window_seconds) - now()))::integer));
    end if;
  end if;

  if short_retry_after > 0 or daily_retry_after > 0 then
    return jsonb_build_object(
      'decision', 'rate_limited',
      'retryAfter', greatest(short_retry_after, daily_retry_after)
    );
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

revoke all on function public.acquire_ai_generation_job(text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.acquire_ai_generation_job(text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer) to service_role;
