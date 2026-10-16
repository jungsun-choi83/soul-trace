create table if not exists public.eternal_beam_access_sessions (
  session_id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (char_length(token_hash) = 64),
  eb_user_id text not null,
  order_id text not null,
  scope text not null check (scope = 'life_archive'),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists eternal_beam_access_sessions_lookup_idx
  on public.eternal_beam_access_sessions(token_hash, scope, expires_at)
  where revoked_at is null;
alter table public.eternal_beam_access_sessions enable row level security;
revoke all on public.eternal_beam_access_sessions from anon, authenticated;
