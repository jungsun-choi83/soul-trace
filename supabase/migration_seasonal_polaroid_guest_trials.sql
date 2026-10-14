-- Seasonal Polaroid guest trial allowance (additive; do not execute without review).
-- Prerequisites: migration_ai_generation_seasonal_polaroid.sql and the existing
-- ai_generation_jobs queue schema. This migration is intentionally isolated
-- from Letter and Visual Memory tables and RPCs.
-- Deployment prerequisite: deploy a worker version that understands the
-- reservation id and version before enabling Seasonal admission. Until then
-- the feature flag must remain false; this migration does not make old
-- workers safe for Seasonal jobs.

do $$
begin
  if to_regclass('public.ai_generation_jobs') is null then
    raise exception 'Guest trial migration requires the Seasonal AI generation queue';
  end if;
end;
$$;

create table if not exists public.seasonal_polaroid_guest_trials (
  guest_hash text primary key check (guest_hash ~ '^[a-f0-9]{64}$'),
  successful_count integer not null default 0 check (successful_count between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seasonal_polaroid_guest_reservations (
  reservation_id uuid primary key default gen_random_uuid(),
  guest_hash text not null references public.seasonal_polaroid_guest_trials(guest_hash) on delete cascade,
  idempotency_key text not null unique check (idempotency_key ~ '^[a-f0-9]{64}$'),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  job_id text unique check (job_id is null or job_id ~ '^[a-f0-9]{64}$'),
  -- Incremented whenever a released reservation is reactivated. Worker
  -- callbacks must present the version they were admitted with so a delayed
  -- failure callback cannot release a later attempt using the same row.
  reservation_version integer not null default 1 check (reservation_version > 0),
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep this migration safe if the table was created by an earlier reviewed
-- draft before the version column was added.
alter table public.seasonal_polaroid_guest_reservations
  add column if not exists reservation_version integer;
update public.seasonal_polaroid_guest_reservations
   set reservation_version = 1
 where reservation_version is null;
alter table public.seasonal_polaroid_guest_reservations
  alter column reservation_version set default 1,
  alter column reservation_version set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.seasonal_polaroid_guest_reservations'::regclass
       and conname = 'seasonal_polaroid_guest_reservations_version_positive'
  ) then
    alter table public.seasonal_polaroid_guest_reservations
      add constraint seasonal_polaroid_guest_reservations_version_positive
      check (reservation_version > 0);
  end if;
end;
$$;

create index if not exists seasonal_polaroid_guest_reservations_guest_idx
  on public.seasonal_polaroid_guest_reservations(guest_hash, status, expires_at);

revoke all on table public.seasonal_polaroid_guest_trials from public, anon, authenticated;
revoke all on table public.seasonal_polaroid_guest_reservations from public, anon, authenticated;
alter table public.seasonal_polaroid_guest_trials enable row level security;
alter table public.seasonal_polaroid_guest_reservations enable row level security;

create or replace function public.reconcile_seasonal_polaroid_guest_trial(
  p_guest_hash text,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trial_row public.seasonal_polaroid_guest_trials%rowtype;
  reservation_row record;
  job_status text;
  job_exists boolean;
  successful integer;
  reserved integer;
begin
  if p_guest_hash is null or p_guest_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid Seasonal guest identity';
  end if;

  insert into public.seasonal_polaroid_guest_trials(guest_hash)
    values (p_guest_hash)
    on conflict (guest_hash) do nothing;
  select * into trial_row
    from public.seasonal_polaroid_guest_trials
    where guest_hash = p_guest_hash
    for update;

  -- A terminal queue row is authoritative. An expired reservation with a
  -- live queued/processing job is failed while holding the queue row lock;
  -- this prevents a late worker completion from succeeding after the slot is
  -- released. Truly abandoned reservations (no job row) are released.
  for reservation_row in
    select * from public.seasonal_polaroid_guest_reservations
     where guest_hash = p_guest_hash and status = 'reserved'
     for update
  loop
    job_status := null;
    job_exists := false;
    if reservation_row.job_id is not null then
      select exists(
        select 1 from public.ai_generation_jobs where idempotency_key = reservation_row.job_id
      ) into job_exists;
      select status into job_status
        from public.ai_generation_jobs
       where idempotency_key = reservation_row.job_id
       for update;
    end if;
    if job_status = 'succeeded' then
      if trial_row.successful_count >= 2 then
        raise exception 'Seasonal guest trial allowance invariant violated';
      end if;
      update public.seasonal_polaroid_guest_reservations
         set status = 'succeeded', updated_at = p_now
       where reservation_id = reservation_row.reservation_id;
      update public.seasonal_polaroid_guest_trials
         set successful_count = successful_count + 1, updated_at = p_now
       where guest_hash = p_guest_hash;
    elsif job_status = 'failed' or reservation_row.expires_at <= p_now then
      if reservation_row.expires_at <= p_now and job_exists
         and job_status in ('queued', 'pending', 'processing') then
        update public.ai_generation_jobs
           set status = 'failed', error_code = 'guest_trial_reservation_expired',
               last_error = 'guest_trial_reservation_expired', lease_expires_at = null,
               next_attempt_at = null, updated_at = p_now, completed_at = p_now
         where idempotency_key = reservation_row.job_id
           and status in ('queued', 'pending', 'processing');
        select status into job_status from public.ai_generation_jobs where idempotency_key = reservation_row.job_id;
      end if;
      if job_status = 'succeeded' then
        if trial_row.successful_count >= 2 then
          raise exception 'Seasonal guest trial allowance invariant violated';
        end if;
        update public.seasonal_polaroid_guest_reservations
           set status = 'succeeded', updated_at = p_now
         where reservation_id = reservation_row.reservation_id;
        update public.seasonal_polaroid_guest_trials
           set successful_count = successful_count + 1, updated_at = p_now
         where guest_hash = p_guest_hash;
      elsif job_status = 'failed' or (reservation_row.expires_at <= p_now and not job_exists) then
        update public.seasonal_polaroid_guest_reservations
           set status = 'released', job_id = null, updated_at = p_now
         where reservation_id = reservation_row.reservation_id;
      end if;
    end if;
  end loop;

  select successful_count into successful
    from public.seasonal_polaroid_guest_trials where guest_hash = p_guest_hash;
  select count(*)::integer into reserved
    from public.seasonal_polaroid_guest_reservations
   where guest_hash = p_guest_hash and status = 'reserved';
  update public.seasonal_polaroid_guest_trials set updated_at = p_now where guest_hash = p_guest_hash;
  return jsonb_build_object(
    'successful', coalesce(successful, 0),
    'reserved', coalesce(reserved, 0),
    'remaining', greatest(0, 2 - coalesce(successful, 0) - coalesce(reserved, 0))
  );
end;
$$;

create or replace function public.reserve_seasonal_polaroid_guest_trial(
  p_guest_hash text,
  p_idempotency_key text,
  p_request_hash text,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trial_row public.seasonal_polaroid_guest_trials%rowtype;
  existing public.seasonal_polaroid_guest_reservations%rowtype;
  active_reserved integer;
  existing_found boolean;
begin
  perform public.reconcile_seasonal_polaroid_guest_trial(p_guest_hash, now());
  select * into trial_row from public.seasonal_polaroid_guest_trials where guest_hash = p_guest_hash for update;
  select * into existing from public.seasonal_polaroid_guest_reservations
   where idempotency_key = p_idempotency_key for update;
  existing_found := found;
  select count(*)::integer into active_reserved
    from public.seasonal_polaroid_guest_reservations
   where guest_hash = p_guest_hash and status = 'reserved';

  if existing_found then
    if existing.guest_hash <> p_guest_hash or existing.request_hash <> p_request_hash then
      return jsonb_build_object('decision', 'unavailable');
    elsif existing.status = 'succeeded' then
      return jsonb_build_object('decision', 'already_succeeded', 'reservation_id', existing.reservation_id,
        'reservation_version', existing.reservation_version,
        'remaining', greatest(0, 2 - trial_row.successful_count - active_reserved));
    elsif existing.status = 'reserved' then
      return jsonb_build_object('decision', 'already_reserved', 'reservation_id', existing.reservation_id,
        'reservation_version', existing.reservation_version,
        'remaining', greatest(0, 2 - trial_row.successful_count - active_reserved));
    else
      if trial_row.successful_count + active_reserved >= 2 then
        return jsonb_build_object('decision', 'exhausted', 'remaining', 0);
      end if;
      update public.seasonal_polaroid_guest_reservations
         set status = 'reserved', job_id = null,
             reservation_version = existing.reservation_version + 1,
             expires_at = p_expires_at, updated_at = now()
       where reservation_id = existing.reservation_id;
      return jsonb_build_object('decision', 'reserved', 'reservation_id', existing.reservation_id,
        'reservation_version', existing.reservation_version + 1,
        'remaining', greatest(0, 2 - trial_row.successful_count - active_reserved - 1));
    end if;
  end if;

  -- A Seasonal queue row created before this trial reservation cannot be
  -- safely reused by an unrelated guest. New requests may reuse only rows
  -- represented by this guest's reservation; failed legacy rows may retry.
  if exists (
    select 1 from public.ai_generation_jobs
     where idempotency_key = p_idempotency_key
       and status in ('pending', 'queued', 'processing', 'succeeded')
  ) then
    return jsonb_build_object('decision', 'unavailable');
  end if;

  select count(*)::integer into active_reserved
    from public.seasonal_polaroid_guest_reservations
   where guest_hash = p_guest_hash and status = 'reserved';
  if trial_row.successful_count + active_reserved >= 2 then
    return jsonb_build_object('decision', 'exhausted', 'remaining', 0);
  end if;

  insert into public.seasonal_polaroid_guest_reservations(
    guest_hash, idempotency_key, request_hash, expires_at
  ) values (p_guest_hash, p_idempotency_key, p_request_hash, p_expires_at)
  returning * into existing;
  return jsonb_build_object('decision', 'reserved', 'reservation_id', existing.reservation_id,
    'reservation_version', existing.reservation_version,
    'remaining', greatest(0, 2 - trial_row.successful_count - active_reserved - 1));
end;
$$;

-- Remove the pre-version signatures if an earlier reviewed draft was applied;
-- otherwise PostgreSQL would retain an unsafe overload beside the new RPC.
drop function if exists public.bind_seasonal_polaroid_guest_trial(uuid, text, text);
drop function if exists public.finalize_seasonal_polaroid_guest_trial(uuid);
drop function if exists public.release_seasonal_polaroid_guest_trial(uuid);

create or replace function public.bind_seasonal_polaroid_guest_trial(
  p_reservation_id uuid,
  p_reservation_version integer,
  p_job_id text,
  p_request_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare changed integer;
begin
  update public.seasonal_polaroid_guest_reservations
     set job_id = p_job_id, updated_at = now()
   where reservation_id = p_reservation_id
     and reservation_version = p_reservation_version
     and request_hash = p_request_hash
     and status = 'reserved'
     and (job_id is null or job_id = p_job_id);
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.finalize_seasonal_polaroid_guest_trial(
  p_reservation_id uuid,
  p_reservation_version integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.seasonal_polaroid_guest_reservations%rowtype;
  trial_row public.seasonal_polaroid_guest_trials%rowtype;
begin
  -- Lock order is always guest trial -> reservation. Reconciliation and
  -- reservation admission use the same order, preventing callback deadlocks.
  select * into trial_row from public.seasonal_polaroid_guest_trials
   where guest_hash = (select guest_hash from public.seasonal_polaroid_guest_reservations where reservation_id = p_reservation_id)
   for update;
  select * into reservation_row from public.seasonal_polaroid_guest_reservations
   where reservation_id = p_reservation_id
     and reservation_version = p_reservation_version
   for update;
  if not found then return false; end if;
  if reservation_row.status = 'succeeded' then return true; end if;
  if reservation_row.status <> 'reserved' then return false; end if;
  if reservation_row.job_id is null or not exists (
    select 1 from public.ai_generation_jobs
     where idempotency_key = reservation_row.job_id and status = 'succeeded'
  ) then return false; end if;
  if trial_row.successful_count >= 2 then
    raise exception 'Seasonal guest trial allowance invariant violated';
  end if;
  update public.seasonal_polaroid_guest_reservations set status = 'succeeded', updated_at = now()
   where reservation_id = p_reservation_id;
  update public.seasonal_polaroid_guest_trials
   set successful_count = successful_count + 1, updated_at = now()
   where guest_hash = reservation_row.guest_hash;
  return true;
end;
$$;

create or replace function public.release_seasonal_polaroid_guest_trial(
  p_reservation_id uuid,
  p_reservation_version integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
  reservation_row public.seasonal_polaroid_guest_reservations%rowtype;
  trial_row public.seasonal_polaroid_guest_trials%rowtype;
  job_status text;
  guest_hash_value text;
begin
  select guest_hash into guest_hash_value
    from public.seasonal_polaroid_guest_reservations
   where reservation_id = p_reservation_id;
  if not found then return false; end if;
  select * into trial_row from public.seasonal_polaroid_guest_trials
   where guest_hash = guest_hash_value for update;
  select * into reservation_row from public.seasonal_polaroid_guest_reservations
   where reservation_id = p_reservation_id
     and reservation_version = p_reservation_version
   for update;
  if not found or reservation_row.status <> 'reserved' then return false; end if;
  if reservation_row.job_id is not null then
    select status into job_status from public.ai_generation_jobs
     where idempotency_key = reservation_row.job_id
     for update;
    if job_status = 'succeeded' then
      if trial_row.successful_count >= 2 then
        raise exception 'Seasonal guest trial allowance invariant violated';
      end if;
      update public.seasonal_polaroid_guest_reservations
         set status = 'succeeded', updated_at = now()
       where reservation_id = p_reservation_id;
      update public.seasonal_polaroid_guest_trials
         set successful_count = successful_count + 1, updated_at = now()
       where guest_hash = reservation_row.guest_hash;
      return false;
    end if;
    -- A retry may have reactivated this same idempotency reservation after an
    -- earlier worker failure. Do not let the stale failure callback release
    -- the new queued/processing attempt.
    if job_status is not null and job_status <> 'failed' then
      return false;
    end if;
  end if;
  update public.seasonal_polaroid_guest_reservations
     set status = 'released', job_id = null, updated_at = now()
   where reservation_id = p_reservation_id and status = 'reserved';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.reconcile_seasonal_polaroid_guest_trial(text, timestamptz) from public, anon, authenticated;
revoke all on function public.reserve_seasonal_polaroid_guest_trial(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.bind_seasonal_polaroid_guest_trial(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.finalize_seasonal_polaroid_guest_trial(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_seasonal_polaroid_guest_trial(uuid, integer) from public, anon, authenticated;
grant execute on function public.reconcile_seasonal_polaroid_guest_trial(text, timestamptz) to service_role;
grant execute on function public.reserve_seasonal_polaroid_guest_trial(text, text, text, timestamptz) to service_role;
grant execute on function public.bind_seasonal_polaroid_guest_trial(uuid, integer, text, text) to service_role;
grant execute on function public.finalize_seasonal_polaroid_guest_trial(uuid, integer) to service_role;
grant execute on function public.release_seasonal_polaroid_guest_trial(uuid, integer) to service_role;
