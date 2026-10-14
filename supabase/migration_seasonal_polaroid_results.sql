-- Seasonal Polaroid account saves. Additive only; do not run automatically.
-- Prerequisite: migration_add_life_archive_foundation.sql (owners table).
do $$
begin
  if to_regclass('public.soul_trace_owners') is null then
    raise exception 'Seasonal Polaroid results require public.soul_trace_owners';
  end if;
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'soul_trace_owners'
       and column_name = 'user_id'
       and data_type = 'uuid'
  ) then
    raise exception 'public.soul_trace_owners.user_id must be uuid';
  end if;
  if not exists (
    select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_schema = tc.constraint_schema
       and kcu.constraint_name = tc.constraint_name
       and kcu.table_name = tc.table_name
     where tc.table_schema = 'public'
       and tc.table_name = 'soul_trace_owners'
       and kcu.column_name = 'user_id'
       and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
  ) then
    raise exception 'public.soul_trace_owners.user_id must be unique';
  end if;
end;
$$;

create table if not exists public.seasonal_polaroid_results (
  result_id uuid primary key,
  job_id text not null,
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_name text not null default '',
  species text not null default '',
  status text not null default '',
  theme_id text not null default 'halloween',
  costume_id text not null default '',
  image_object_key text not null,
  memo_line_1 text not null default '',
  memo_line_2 text not null default '',
  memo_line_3 text not null default '',
  memo_line_4 text not null default '',
  memo_locale text not null default 'en',
  generation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint seasonal_polaroid_results_job_id_format check (job_id ~ '^[0-9a-f]{64}$'),
  constraint seasonal_polaroid_results_status_check check (status in ('living', 'passed')),
  constraint seasonal_polaroid_results_locale_check check (memo_locale in ('en', 'ko')),
  constraint seasonal_polaroid_results_image_key_check check (image_object_key ~ '^seasonal-polaroid/[0-9a-f]{64}/result/[A-Za-z0-9_-]{16,64}[.]jpg$')
);

-- Make reruns safe if an earlier local application created the initial unique
-- job constraint or the stable result-path check before attempt-scoped paths
-- were introduced. This does not affect any other table constraint.
alter table public.seasonal_polaroid_results
  drop constraint if exists seasonal_polaroid_results_job_id_key,
  drop constraint if exists seasonal_polaroid_results_image_key_check;

alter table public.seasonal_polaroid_results
  add constraint seasonal_polaroid_results_image_key_check
  check (image_object_key ~ '^seasonal-polaroid/[0-9a-f]{64}/result/[A-Za-z0-9_-]{16,64}[.]jpg$');

create index if not exists seasonal_polaroid_results_owner_idx
  on public.seasonal_polaroid_results (owner_user_id, created_at desc);

create index if not exists seasonal_polaroid_results_job_idx
  on public.seasonal_polaroid_results (job_id, created_at desc);

alter table public.seasonal_polaroid_results enable row level security;

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'seasonal_polaroid_results'
       and policyname = 'Owners can read their seasonal polaroids'
  ) then
    create policy "Owners can read their seasonal polaroids"
      on public.seasonal_polaroid_results for select to authenticated
      using (owner_user_id = auth.uid());
  end if;
end;
$$;

-- Keep direct client writes disabled. The authenticated role may read only its
-- own rows through the policy below; the trusted server role performs saves.
revoke all on table public.seasonal_polaroid_results from public, anon, authenticated;
grant select on table public.seasonal_polaroid_results to authenticated;
grant select, insert on table public.seasonal_polaroid_results to service_role;

-- Writes are intentionally performed by the server route after capability and
-- Supabase-session validation. No client INSERT policy is granted here.
