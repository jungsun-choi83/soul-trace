-- One free polaroid per pet. Additive. Does not change letter tables or delete rows.
-- Apply only with approval. Rollback: supabase/rollback_pet_free_entitlements.sql.

create table if not exists public.pet_free_entitlements (
  entitlement_id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete restrict,
  grant_kind text not null default 'polaroid_first' check (grant_kind = 'polaroid_first'),
  status text not null default 'available' check (status in ('available', 'reserved', 'consumed')),
  idempotency_key text unique check (idempotency_key is null or idempotency_key ~ '^[A-Za-z0-9_-]{8,80}$'),
  job_id uuid,
  granted_at timestamptz not null default now(),
  consumed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (pet_id, grant_kind)
);

create table if not exists public.generation_jobs (
  job_id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete restrict,
  owner_user_id uuid,
  guest_session_id uuid,
  kind text not null default 'polaroid' check (kind = 'polaroid'),
  style text not null check (style in ('felt-doll', 'gouache-story', 'crayon-diary')),
  status text not null check (status in ('reserved', 'succeeded', 'failed')),
  idempotency_key text not null unique check (idempotency_key ~ '^[A-Za-z0-9_-]{8,80}$'),
  expires_at timestamptz not null default (now() + interval '72 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pet_free_entitlements_one_polaroid_idx
  on public.pet_free_entitlements (pet_id) where grant_kind = 'polaroid_first';

alter table public.pet_free_entitlements enable row level security;
alter table public.generation_jobs enable row level security;
revoke all on table public.pet_free_entitlements from public, anon, authenticated;
revoke all on table public.generation_jobs from public, anon, authenticated;

create or replace function public.reserve_pet_free_polaroid(
  p_pet_id uuid,
  p_owner_user_id uuid,
  p_style text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.generation_jobs%rowtype;
  grant_row public.pet_free_entitlements%rowtype;
  new_job uuid;
begin
  if p_owner_user_id is null or p_style not in ('felt-doll', 'gouache-story', 'crayon-diary')
     or p_idempotency_key !~ '^[A-Za-z0-9_-]{8,80}$' then
    return jsonb_build_object('error', 'invalid');
  end if;
  if not exists (
    select 1 from public.soul_trace_pets
    where pet_id = p_pet_id and owner_user_id = p_owner_user_id
  ) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select * into existing from public.generation_jobs where idempotency_key = p_idempotency_key for update;
  if found then
    if existing.pet_id <> p_pet_id then
      return jsonb_build_object('error', 'forbidden');
    end if;
    if existing.status <> 'failed' then
      return jsonb_build_object('jobId', existing.job_id, 'replayed', true, 'style', existing.style);
    end if;
    delete from public.generation_jobs where job_id = existing.job_id;
  end if;

  insert into public.pet_free_entitlements (pet_id)
  values (p_pet_id)
  on conflict (pet_id, grant_kind) do nothing;
  select * into grant_row from public.pet_free_entitlements
   where pet_id = p_pet_id and grant_kind = 'polaroid_first' for update;
  if grant_row.status <> 'available' then
    return jsonb_build_object('error', 'exhausted');
  end if;

  new_job := gen_random_uuid();
  insert into public.generation_jobs (job_id, pet_id, owner_user_id, style, status, idempotency_key)
  values (new_job, p_pet_id, p_owner_user_id, p_style, 'reserved', p_idempotency_key);
  update public.pet_free_entitlements
     set status = 'reserved', idempotency_key = p_idempotency_key, job_id = new_job, updated_at = now()
   where entitlement_id = grant_row.entitlement_id;
  return jsonb_build_object('jobId', new_job, 'replayed', false, 'style', p_style);
end;
$$;

create or replace function public.finish_pet_free_polaroid(p_job_id uuid, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_ok then
    update public.generation_jobs set status = 'succeeded', updated_at = now() where job_id = p_job_id and status = 'reserved';
    update public.pet_free_entitlements
       set status = 'consumed', consumed_at = now(), updated_at = now()
     where job_id = p_job_id and status = 'reserved';
  else
    update public.generation_jobs set status = 'failed', updated_at = now() where job_id = p_job_id and status = 'reserved';
    update public.pet_free_entitlements
       set status = 'available', idempotency_key = null, job_id = null, updated_at = now()
     where job_id = p_job_id and status = 'reserved';
  end if;
end;
$$;

revoke all on function public.reserve_pet_free_polaroid(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.finish_pet_free_polaroid(uuid, boolean) from public, anon, authenticated;
