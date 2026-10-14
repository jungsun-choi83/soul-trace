-- Phase 3C-2: make Seasonal input attachment first-writer-wins.
--
-- This is additive and must be applied after
-- migration_ai_generation_queue.sql and migration_ai_generation_seasonal_polaroid.sql.
-- It does not change the letter or Visual Memory attachment behavior.

do $$
begin
  if to_regclass('public.ai_generation_jobs') is null
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'ai_generation_jobs'
          and column_name = 'input_ready'
     ) then
    raise exception 'Seasonal input ownership migration requires the AI generation queue schema';
  end if;
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
      -- Seasonal attempts use unique object paths. The first attached attempt
      -- owns the job; a racing duplicate cannot replace or orphan its refs.
      and (generation_kind <> 'seasonal_polaroid' or input_ready = false)
  returning true;
$$;

revoke all on function public.set_ai_generation_input(text,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.set_ai_generation_input(text,text,jsonb,text,text) to service_role;
