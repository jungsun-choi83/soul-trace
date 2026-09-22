create table if not exists public.kickstarter_waitlist (
  signup_id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    char_length(email) between 3 and 254
    and email = lower(email)
  ),
  locale text not null default 'en' check (locale in ('en', 'ko')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kickstarter_waitlist enable row level security;
revoke all on public.kickstarter_waitlist from anon, authenticated;
