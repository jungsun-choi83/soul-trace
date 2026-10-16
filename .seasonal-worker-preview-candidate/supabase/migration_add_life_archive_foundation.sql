-- Phase 2: verified owners and ID-based Soul Trace / Life Archive foundation.
-- This migration is additive. Existing Soul Trace tables remain the source used
-- by the current result flow until Phase 3 connects the new records.

create table if not exists public.soul_trace_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.soul_trace_pets (
  pet_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.soul_trace_owners (user_id) on delete cascade,
  pet_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists soul_trace_pets_owner_idx
  on public.soul_trace_pets (owner_user_id);

create table if not exists public.soul_trace_submissions (
  submission_id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete cascade,
  owner_user_id uuid references public.soul_trace_owners (user_id) on delete cascade,
  letter_id uuid not null unique,
  generated_letter text not null,
  personality_type text not null,
  preferred_scenery text not null,
  generation_locale text check (generation_locale is null or generation_locale in ('en', 'ko')),
  hero_image_url text,
  hero_image_ref text,
  created_at timestamptz not null default now(),
  unique (submission_id, pet_id, owner_user_id)
);

create index if not exists soul_trace_submissions_owner_idx
  on public.soul_trace_submissions (owner_user_id);
create index if not exists soul_trace_submissions_pet_idx
  on public.soul_trace_submissions (pet_id);

create table if not exists public.soul_trace_submission_answers (
  answer_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.soul_trace_submissions (submission_id) on delete cascade,
  answer_order int not null check (answer_order between 1 and 8),
  question text not null,
  answer text not null,
  unique (submission_id, answer_order)
);

create index if not exists soul_trace_submission_answers_submission_idx
  on public.soul_trace_submission_answers (submission_id);

create table if not exists public.life_archive_memories (
  memory_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete cascade,
  submission_id uuid not null,
  title text,
  story text not null check (length(btrim(story)) > 0),
  memory_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (submission_id, pet_id, owner_user_id)
    references public.soul_trace_submissions (submission_id, pet_id, owner_user_id)
    on delete cascade
);

create index if not exists life_archive_memories_archive_idx
  on public.life_archive_memories (owner_user_id, pet_id, submission_id, created_at desc);

-- Private bridge for old email-keyed rows. New ownership always uses UUIDs.
create table if not exists public.soul_trace_legacy_links (
  user_email text primary key references public.soul_trace_profiles (user_email) on delete cascade,
  pet_id uuid not null unique references public.soul_trace_pets (pet_id) on delete cascade,
  submission_id uuid not null unique references public.soul_trace_submissions (submission_id) on delete cascade,
  letter_id uuid not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.sync_soul_trace_legacy_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_pet_id uuid;
  linked_submission_id uuid;
begin
  select pet_id, submission_id
    into linked_pet_id, linked_submission_id
    from public.soul_trace_legacy_links
   where user_email = new.user_email;

  if linked_pet_id is null then
    insert into public.soul_trace_pets (pet_name, created_at)
    values (new.pet_name, new.created_at)
    returning pet_id into linked_pet_id;

    insert into public.soul_trace_submissions (
      pet_id, letter_id, generated_letter, personality_type,
      preferred_scenery, generation_locale, hero_image_url,
      hero_image_ref, created_at
    ) values (
      linked_pet_id, new.letter_id, new.generated_letter, new.personality_type,
      new.preferred_scenery, new.generation_locale, new.hero_image_url,
      new.hero_image_ref, new.created_at
    ) returning submission_id into linked_submission_id;

    insert into public.soul_trace_legacy_links (
      user_email, pet_id, submission_id, letter_id
    ) values (
      new.user_email, linked_pet_id, linked_submission_id, new.letter_id
    );
  else
    update public.soul_trace_pets
       set pet_name = new.pet_name
     where pet_id = linked_pet_id;

    update public.soul_trace_submissions
       set letter_id = new.letter_id,
           generated_letter = new.generated_letter,
           personality_type = new.personality_type,
           preferred_scenery = new.preferred_scenery,
           generation_locale = new.generation_locale,
           hero_image_url = new.hero_image_url,
           hero_image_ref = new.hero_image_ref
     where submission_id = linked_submission_id;

    update public.soul_trace_legacy_links
       set letter_id = new.letter_id
     where user_email = new.user_email;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_soul_trace_legacy_profile_trigger
  on public.soul_trace_profiles;
create trigger sync_soul_trace_legacy_profile_trigger
after insert or update of pet_name, personality_type, generated_letter,
  preferred_scenery, generation_locale, hero_image_url, hero_image_ref, letter_id
on public.soul_trace_profiles
for each row execute function public.sync_soul_trace_legacy_profile();

-- Create ID-based copies without changing values in the legacy profiles. The
-- harmless self-assignment fires the sync trigger only for rows not yet linked.
update public.soul_trace_profiles
   set pet_name = pet_name
 where user_email not in (select user_email from public.soul_trace_legacy_links);

insert into public.soul_trace_submission_answers (
  submission_id, answer_order, question, answer
)
select links.submission_id, answers.answer_order, answers.question, answers.answer
  from public.soul_trace_answers answers
  join public.soul_trace_legacy_links links using (user_email)
on conflict (submission_id, answer_order) do update
set question = excluded.question,
    answer = excluded.answer;

create or replace function public.sync_soul_trace_legacy_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_submission_id uuid;
begin
  if tg_op = 'DELETE' then
    select submission_id into linked_submission_id
      from public.soul_trace_legacy_links
     where user_email = old.user_email;
    delete from public.soul_trace_submission_answers
     where submission_id = linked_submission_id
       and answer_order = old.answer_order;
    return old;
  end if;

  select submission_id into linked_submission_id
    from public.soul_trace_legacy_links
   where user_email = new.user_email;

  if linked_submission_id is not null then
    insert into public.soul_trace_submission_answers (
      submission_id, answer_order, question, answer
    ) values (
      linked_submission_id, new.answer_order, new.question, new.answer
    )
    on conflict (submission_id, answer_order) do update
    set question = excluded.question,
        answer = excluded.answer;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_soul_trace_legacy_answer_trigger
  on public.soul_trace_answers;
create trigger sync_soul_trace_legacy_answer_trigger
after insert or update or delete on public.soul_trace_answers
for each row execute function public.sync_soul_trace_legacy_answer();

-- Called only by an authenticated, email-verified Supabase user. It connects all
-- matching legacy records once, then access is based on user_id, never email.
create or replace function public.claim_soul_trace_legacy_records()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_user_id uuid := auth.uid();
  verified_email text;
  claimed_count int;
begin
  select lower(email)
    into verified_email
    from auth.users
   where id = verified_user_id
     and email_confirmed_at is not null;

  if verified_user_id is null or verified_email is null then
    raise exception 'A verified owner session is required';
  end if;

  if exists (
    select 1
      from public.soul_trace_legacy_links links
      join public.soul_trace_submissions submissions
        on submissions.submission_id = links.submission_id
     where lower(links.user_email) = verified_email
       and submissions.owner_user_id is not null
       and submissions.owner_user_id <> verified_user_id
  ) then
    raise exception 'These Soul Trace records already belong to another owner';
  end if;

  insert into public.soul_trace_owners (user_id)
  values (verified_user_id)
  on conflict (user_id) do update set verified_at = now();

  update public.soul_trace_pets pets
     set owner_user_id = verified_user_id
    from public.soul_trace_legacy_links links
   where pets.pet_id = links.pet_id
     and lower(links.user_email) = verified_email
     and (pets.owner_user_id is null or pets.owner_user_id = verified_user_id);

  update public.soul_trace_submissions submissions
     set owner_user_id = verified_user_id
    from public.soul_trace_legacy_links links
   where submissions.submission_id = links.submission_id
     and lower(links.user_email) = verified_email
     and (submissions.owner_user_id is null or submissions.owner_user_id = verified_user_id);

  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;

revoke all on function public.claim_soul_trace_legacy_records() from public;
grant execute on function public.claim_soul_trace_legacy_records() to authenticated;

alter table public.soul_trace_owners enable row level security;
alter table public.soul_trace_pets enable row level security;
alter table public.soul_trace_submissions enable row level security;
alter table public.soul_trace_submission_answers enable row level security;
alter table public.life_archive_memories enable row level security;
alter table public.soul_trace_legacy_links enable row level security;

create policy "Owners can read their owner record"
on public.soul_trace_owners for select to authenticated
using (user_id = auth.uid());

create policy "Owners can read their pets"
on public.soul_trace_pets for select to authenticated
using (owner_user_id = auth.uid());

create policy "Owners can read their submissions"
on public.soul_trace_submissions for select to authenticated
using (owner_user_id = auth.uid());

create policy "Owners can read their original answers"
on public.soul_trace_submission_answers for select to authenticated
using (exists (
  select 1 from public.soul_trace_submissions submissions
   where submissions.submission_id = soul_trace_submission_answers.submission_id
     and submissions.owner_user_id = auth.uid()
));

create policy "Owners can read their archive memories"
on public.life_archive_memories for select to authenticated
using (owner_user_id = auth.uid());

comment on table public.soul_trace_legacy_links is
  'Private bridge from the legacy email-keyed model to pet/submission UUIDs; never use it for authorization.';
comment on column public.soul_trace_submissions.generated_letter is
  'Exact saved letter text. Interface locale changes must never translate or replace it.';
comment on table public.soul_trace_submission_answers is
  'Read-only copies of original Soul Trace answers. Orders 1-5 are memory answers; 6-8 are letter-tone answers.';
comment on table public.life_archive_memories is
  'New owner-written memories only. Phase 4 will add authenticated write policies and UI.';
