-- Phase 3A review draft only. Do not apply automatically. Prerequisite:
-- inspect/apply the owner-pet foundation for this environment, then verify
-- public.soul_trace_owners, public.soul_trace_pets, and Supabase Storage.
-- Free Trial records stay separate from normal Polaroid/Letter/archive systems.
do $$
begin
  if to_regclass('public.soul_trace_owners') is null
     or to_regclass('public.soul_trace_pets') is null
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='soul_trace_owners' and column_name='user_id' and data_type='uuid')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='soul_trace_pets' and column_name='pet_id' and data_type='uuid') then
    raise exception 'Free Trial persistence requires reviewed Soul Trace UUID owner/pet schema';
  end if;
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu using (constraint_catalog,constraint_schema,constraint_name,table_name)
    where tc.table_schema='public' and tc.table_name='soul_trace_owners'
      and tc.constraint_type in ('PRIMARY KEY','UNIQUE') and kcu.column_name='user_id'
  ) or not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu using (constraint_catalog,constraint_schema,constraint_name,table_name)
    where tc.table_schema='public' and tc.table_name='soul_trace_pets'
      and tc.constraint_type in ('PRIMARY KEY','UNIQUE') and kcu.column_name='pet_id'
  ) then
    raise exception 'Free Trial persistence requires unique owner.user_id and pet.pet_id keys';
  end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid='public.soul_trace_owners'::regclass
      and c.confrelid='auth.users'::regclass and c.contype='f'
  ) then
    raise exception 'Free Trial ownership requires soul_trace_owners.user_id to reference auth.users';
  end if;
  if to_regclass('storage.buckets') is null then
    raise exception 'Free Trial persistence requires Supabase Storage';
  end if;
  if exists(select 1 from storage.buckets where id='free-trial-results' and public) then
    raise exception 'The free-trial-results bucket already exists as public; inspect it before proceeding';
  end if;
end $$;

create table if not exists public.free_trial_pets (
  pet_id uuid primary key default gen_random_uuid(),
  guest_session_hash text,
  owner_user_id uuid references public.soul_trace_owners(user_id) on delete cascade,
  pet_name text not null check(length(btrim(pet_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((guest_session_hash is not null and owner_user_id is null) or (guest_session_hash is null and owner_user_id is not null)),
  check (guest_session_hash is null or guest_session_hash ~ '^[a-f0-9]{64}$')
);
create unique index if not exists free_trial_pets_guest_idx on public.free_trial_pets(guest_session_hash) where guest_session_hash is not null;
create index if not exists free_trial_pets_owner_idx on public.free_trial_pets(owner_user_id,created_at desc);

create table if not exists public.free_trial_generations (
  generation_id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.free_trial_pets(pet_id) on delete cascade,
  idempotency_key text not null unique check(idempotency_key ~ '^[A-Za-z0-9_-]{8,80}$'),
  request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
  style text not null check(style in ('felt-doll','gouache-story','crayon-diary')),
  theme text not null check(theme ~ '^[a-z0-9-]{1,48}$'),
  status text not null check(status in ('reserved','failed','succeeded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.free_trial_allowances (
  pet_id uuid primary key references public.free_trial_pets(pet_id) on delete cascade,
  status text not null default 'available' check(status in ('available','reserved','consumed')),
  generation_id uuid unique references public.free_trial_generations(generation_id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.free_trial_results (
  result_id uuid primary key references public.free_trial_generations(generation_id) on delete cascade,
  pet_id uuid not null references public.free_trial_pets(pet_id) on delete cascade,
  owner_user_id uuid references public.soul_trace_owners(user_id) on delete cascade,
  guest_session_hash text check(guest_session_hash is null or guest_session_hash ~ '^[a-f0-9]{64}$'),
  object_key text not null unique,
  style text not null check(style in ('felt-doll','gouache-story','crayon-diary')),
  theme text not null check(theme ~ '^[a-z0-9-]{1,48}$'),
  created_at timestamptz not null default now(),
  check ((guest_session_hash is not null and owner_user_id is null) or (guest_session_hash is null and owner_user_id is not null)),
  check (object_key = 'free-trial/' || result_id::text || '.jpg')
);
create index if not exists free_trial_results_owner_idx on public.free_trial_results(owner_user_id,created_at desc);
create table if not exists public.free_trial_admission_events (
  event_id bigint generated always as identity primary key,
  ip_hash text not null check(ip_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists free_trial_admission_ip_idx on public.free_trial_admission_events(ip_hash,created_at desc);
create table if not exists public.free_trial_guest_claims (
  guest_session_hash text primary key check(guest_session_hash ~ '^[a-f0-9]{64}$'),
  owner_user_id uuid not null references public.soul_trace_owners(user_id) on delete cascade,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null default(now()+interval '30 days')
);

alter table public.free_trial_pets enable row level security;
alter table public.free_trial_generations enable row level security;
alter table public.free_trial_allowances enable row level security;
alter table public.free_trial_results enable row level security;
alter table public.free_trial_admission_events enable row level security;
alter table public.free_trial_guest_claims enable row level security;
revoke all on public.free_trial_pets,public.free_trial_generations,public.free_trial_allowances,public.free_trial_results,public.free_trial_admission_events,public.free_trial_guest_claims from public,anon,authenticated;
grant select,insert,update,delete on public.free_trial_pets,public.free_trial_generations,public.free_trial_allowances,public.free_trial_results,public.free_trial_admission_events,public.free_trial_guest_claims to service_role;
grant usage,select on sequence public.free_trial_admission_events_event_id_seq to service_role;
insert into storage.buckets(id,name,public) values('free-trial-results','free-trial-results',false) on conflict(id) do nothing;

create or replace function public.register_free_trial_pet(p_guest_hash text,p_owner_id uuid,p_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.free_trial_pets%rowtype;
begin
  if (p_guest_hash is null)=(p_owner_id is null) or p_name is null or length(btrim(p_name)) not between 1 and 40 then return jsonb_build_object('error','invalid'); end if;
  if p_guest_hash is not null then
    if p_guest_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','invalid'); end if;
    perform pg_advisory_xact_lock(hashtextextended('free-trial-pet:'||p_guest_hash,0));
    select * into p from public.free_trial_pets where guest_session_hash=p_guest_hash for update;
    if found then update public.free_trial_pets set pet_name=btrim(p_name),updated_at=now() where pet_id=p.pet_id; return jsonb_build_object('pet_id',p.pet_id); end if;
  elsif not exists(select 1 from public.soul_trace_owners where user_id=p_owner_id) then return jsonb_build_object('error','owner_missing'); end if;
  insert into public.free_trial_pets(guest_session_hash,owner_user_id,pet_name) values(p_guest_hash,p_owner_id,btrim(p_name)) returning * into p;
  insert into public.free_trial_allowances(pet_id) values(p.pet_id);
  return jsonb_build_object('pet_id',p.pet_id);
end $$;

create or replace function public.reserve_free_trial_generation(p_pet_id uuid,p_guest_hash text,p_owner_id uuid,p_ip_hash text,p_key text,p_hash text,p_style text,p_theme text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.free_trial_pets%rowtype; a public.free_trial_allowances%rowtype; g public.free_trial_generations%rowtype; n integer;
begin
  if p_ip_hash !~ '^[a-f0-9]{64}$' or p_hash !~ '^[a-f0-9]{64}$' or p_key !~ '^[A-Za-z0-9_-]{8,80}$' or p_style not in ('felt-doll','gouache-story','crayon-diary') or p_theme !~ '^[a-z0-9-]{1,48}$' then return jsonb_build_object('decision','invalid'); end if;
  select * into p from public.free_trial_pets where pet_id=p_pet_id for update;
  if not found or p.guest_session_hash is distinct from p_guest_hash or p.owner_user_id is distinct from p_owner_id then return jsonb_build_object('decision','forbidden'); end if;
  select * into g from public.free_trial_generations where idempotency_key=p_key for update;
  if found then
    if g.pet_id<>p_pet_id or g.request_hash<>p_hash then return jsonb_build_object('decision','conflict'); end if;
    if g.status='succeeded' then return jsonb_build_object('decision','succeeded','result_id',g.generation_id); end if;
    if g.status='reserved' and g.updated_at>now()-interval '5 minutes' then return jsonb_build_object('decision','in_progress','result_id',g.generation_id); end if;
    if g.status='reserved' then
      update public.free_trial_generations set status='failed',updated_at=now() where generation_id=g.generation_id;
      update public.free_trial_allowances set status='available',generation_id=null,updated_at=now()
        where pet_id=p_pet_id and generation_id=g.generation_id and status='reserved';
      g.status := 'failed';
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('soul-trace-free-trial-admission',0));
  delete from public.free_trial_admission_events where created_at<now()-interval '2 days';
  select count(*)::integer into n from public.free_trial_admission_events where ip_hash=p_ip_hash and created_at>now()-interval '1 hour';
  if n>=5 then return jsonb_build_object('decision','rate_limited'); end if;
  select * into a from public.free_trial_allowances where pet_id=p_pet_id for update;
  if not found then insert into public.free_trial_allowances(pet_id) values(p_pet_id) on conflict do nothing; select * into a from public.free_trial_allowances where pet_id=p_pet_id for update; end if;
  if a.status<>'available' then return jsonb_build_object('decision','exhausted'); end if;
  insert into public.free_trial_admission_events(ip_hash) values(p_ip_hash);
  if g.generation_id is null then
    insert into public.free_trial_generations(pet_id,idempotency_key,request_hash,style,theme,status) values(p_pet_id,p_key,p_hash,p_style,p_theme,'reserved') returning * into g;
  else
    update public.free_trial_generations set status='reserved',updated_at=now() where generation_id=g.generation_id returning * into g;
  end if;
  update public.free_trial_allowances set status='reserved',generation_id=g.generation_id,updated_at=now() where pet_id=p_pet_id;
  return jsonb_build_object('decision','reserved','result_id',g.generation_id);
end $$;

create or replace function public.complete_free_trial_generation(p_result_id uuid,p_pet_id uuid,p_guest_hash text,p_owner_id uuid,p_object_key text,p_style text,p_theme text)
returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  if p_object_key<>'free-trial/'||p_result_id::text||'.jpg' then return false; end if;
  if not exists(select 1 from public.free_trial_pets where pet_id=p_pet_id and guest_session_hash is not distinct from p_guest_hash and owner_user_id is not distinct from p_owner_id) then return false; end if;
  if not exists(select 1 from public.free_trial_generations where generation_id=p_result_id and pet_id=p_pet_id and status='reserved' and style=p_style and theme=p_theme) then
    return exists(select 1 from public.free_trial_results where result_id=p_result_id and pet_id=p_pet_id and object_key=p_object_key);
  end if;
  insert into public.free_trial_results(result_id,pet_id,owner_user_id,guest_session_hash,object_key,style,theme) values(p_result_id,p_pet_id,p_owner_id,p_guest_hash,p_object_key,p_style,p_theme) on conflict(result_id) do nothing;
  update public.free_trial_generations set status='succeeded',updated_at=now() where generation_id=p_result_id and status='reserved';
  update public.free_trial_allowances set status='consumed',updated_at=now() where pet_id=p_pet_id and generation_id=p_result_id and status='reserved';
  get diagnostics changed=row_count; return changed=1;
end $$;
create or replace function public.fail_free_trial_generation(p_result_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare pet uuid;
begin
  update public.free_trial_generations set status='failed',updated_at=now() where generation_id=p_result_id and status='reserved' returning pet_id into pet;
  if not found then return false; end if;
  update public.free_trial_allowances set status='available',generation_id=null,updated_at=now() where pet_id=pet and generation_id=p_result_id and status='reserved';
  return true;
end $$;

create or replace function public.claim_free_trial_guest(p_guest_hash text,p_owner_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare prior uuid; prior_expiry timestamptz;
begin
  if p_guest_hash !~ '^[a-f0-9]{64}$' or not exists(select 1 from public.soul_trace_owners where user_id=p_owner_id) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('free-trial-claim:'||p_guest_hash,0));
  select owner_user_id,expires_at into prior,prior_expiry from public.free_trial_guest_claims where guest_session_hash=p_guest_hash for update;
  if found then
    if prior<>p_owner_id or prior_expiry<=now() then return false; end if;
    update public.free_trial_pets set owner_user_id=p_owner_id,guest_session_hash=null,updated_at=now() where guest_session_hash=p_guest_hash;
    update public.free_trial_results set owner_user_id=p_owner_id,guest_session_hash=null where guest_session_hash=p_guest_hash;
    return true;
  end if;
  if not exists(select 1 from public.free_trial_pets where guest_session_hash=p_guest_hash) then return false; end if;
  insert into public.free_trial_guest_claims(guest_session_hash,owner_user_id) values(p_guest_hash,p_owner_id);
  update public.free_trial_pets set owner_user_id=p_owner_id,guest_session_hash=null,updated_at=now() where guest_session_hash=p_guest_hash;
  update public.free_trial_results set owner_user_id=p_owner_id,guest_session_hash=null where guest_session_hash=p_guest_hash;
  return true;
end $$;
create or replace function public.authorize_free_trial_result(p_result_id uuid,p_guest_hash text,p_owner_id uuid)
returns text language sql security definer set search_path=public as $$
  select object_key from public.free_trial_results where result_id=p_result_id and ((p_owner_id is not null and owner_user_id=p_owner_id) or (p_guest_hash is not null and guest_session_hash=p_guest_hash)) limit 1;
$$;

revoke all on function public.register_free_trial_pet(text,uuid,text) from public,anon,authenticated;
revoke all on function public.reserve_free_trial_generation(uuid,text,uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.complete_free_trial_generation(uuid,uuid,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.fail_free_trial_generation(uuid) from public,anon,authenticated;
revoke all on function public.claim_free_trial_guest(text,uuid) from public,anon,authenticated;
revoke all on function public.authorize_free_trial_result(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.register_free_trial_pet(text,uuid,text) to service_role;
grant execute on function public.reserve_free_trial_generation(uuid,text,uuid,text,text,text,text,text) to service_role;
grant execute on function public.complete_free_trial_generation(uuid,uuid,text,uuid,text,text,text) to service_role;
grant execute on function public.fail_free_trial_generation(uuid) to service_role;
grant execute on function public.claim_free_trial_guest(text,uuid) to service_role;
grant execute on function public.authorize_free_trial_result(uuid,text,uuid) to service_role;
-- No Memory Archive/timeline rows are written by these functions.
