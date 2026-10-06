-- Visual Memory results saved from the current signed proof.
-- This file is not applied to production by the application deploy.
create table if not exists public.visual_memory_results (
  result_id uuid primary key,
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_name text not null default '',
  title text not null default '',
  caption text not null default '',
  image_data_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists visual_memory_results_owner_idx
  on public.visual_memory_results (owner_user_id, created_at desc);

alter table public.visual_memory_results enable row level security;

create policy "Owners can read their visual memories"
on public.visual_memory_results for select to authenticated
using (owner_user_id = auth.uid());
