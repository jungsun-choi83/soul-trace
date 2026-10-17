-- Durable, revocable share links for generated letters. Additive only.
-- Apply after the submission/owner tables exist. Service-role server routes are
-- the only writers/readers; public clients never receive table privileges.
create table if not exists public.letter_shares (
  share_id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  letter_id uuid not null references public.soul_trace_submissions (letter_id) on delete cascade,
  owner_user_id uuid references public.soul_trace_owners (user_id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists letter_shares_letter_idx on public.letter_shares (letter_id, created_at desc);
create index if not exists letter_shares_expiry_idx on public.letter_shares (expires_at) where revoked_at is null;

alter table public.letter_shares enable row level security;
revoke all on table public.letter_shares from public, anon, authenticated;
grant select, insert on table public.letter_shares to service_role;
