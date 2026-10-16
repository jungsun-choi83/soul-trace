-- Phase 1 queue recovery scheduler.
--
-- This migration intentionally does not enable extensions or create Vault
-- secrets. Enable pg_cron and pg_net in the Supabase Dashboard first, then
-- create these Vault secrets manually (without committing their values):
--   soul_trace_ai_worker_url  = https://soultrace.pet/api/internal/ai-worker
--   soul_trace_cron_secret    = the same value as Vercel CRON_SECRET
--
-- The migration fails closed when those prerequisites are not present. The
-- Next.js after() wake-up remains the fast path; this job is only recovery.
-- Apply it only after the matching worker code and CRON_SECRET are live.

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not enabled; enable it in Supabase before applying this migration';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net is not enabled; enable it in Supabase before applying this migration';
  end if;
  if to_regclass('vault.decrypted_secrets') is null then
    raise exception 'Supabase Vault is not available; configure Vault before applying this migration';
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'net.http_post(text,jsonb,jsonb,jsonb,integer) is not available';
  end if;
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise exception 'cron.schedule(text,text,text) is not available';
  end if;
end
$$;

create or replace function public.invoke_ai_generation_worker_from_cron()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  worker_url text;
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret
    into worker_url
    from vault.decrypted_secrets
   where name = 'soul_trace_ai_worker_url';

  select decrypted_secret
    into cron_secret
    from vault.decrypted_secrets
   where name = 'soul_trace_cron_secret';

  if worker_url is null or worker_url !~ '^https://[^[:space:]]+/api/internal/ai-worker$' then
    raise exception 'Vault secret soul_trace_ai_worker_url is missing or invalid';
  end if;
  if cron_secret is null or length(trim(cron_secret)) < 16 then
    raise exception 'Vault secret soul_trace_cron_secret is missing or too short';
  end if;

  select net.http_post(
    url := worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := jsonb_build_object('source', 'supabase-cron'),
    -- Leave enough time for the existing Vercel worker to finish below its
    -- 240-second maxDuration. pg_net queues the request asynchronously.
    timeout_milliseconds := 230000
  )
    into request_id;

  return request_id;
end;
$$;

-- The scheduler is the only intended caller. The function owner (postgres)
-- executes it through pg_cron; browser roles must not call it directly.
revoke all on function public.invoke_ai_generation_worker_from_cron() from public, anon, authenticated;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
      from cron.job
     where jobname = 'soul-trace-ai-generation-recovery'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'soul-trace-ai-generation-recovery',
    '* * * * *',
    'select public.invoke_ai_generation_worker_from_cron();'
  );
end
$$;
