-- Make letter_id, not account email, the identity of a generated letter.
drop trigger if exists sync_soul_trace_legacy_answer_trigger on public.soul_trace_answers;
drop trigger if exists sync_soul_trace_legacy_profile_trigger on public.soul_trace_profiles;

alter table public.soul_trace_legacy_links
  drop constraint if exists soul_trace_legacy_links_user_email_fkey,
  drop constraint if exists soul_trace_legacy_links_pkey;

alter table public.soul_trace_answers
  add column if not exists letter_id uuid;
update public.soul_trace_answers answers
   set letter_id = profiles.letter_id
  from public.soul_trace_profiles profiles
 where answers.letter_id is null
   and answers.user_email = profiles.user_email;
alter table public.soul_trace_answers
  alter column letter_id set not null,
  drop constraint if exists soul_trace_answers_user_email_fkey,
  drop constraint if exists soul_trace_answers_user_email_answer_order_key;

alter table public.soul_trace_profiles
  drop constraint if exists soul_trace_profiles_pkey;
alter table public.soul_trace_profiles
  add primary key (letter_id);
create index if not exists soul_trace_profiles_user_email_idx
  on public.soul_trace_profiles (user_email, created_at desc);

alter table public.soul_trace_answers
  add constraint soul_trace_answers_letter_id_fkey
    foreign key (letter_id) references public.soul_trace_profiles(letter_id) on delete cascade,
  add constraint soul_trace_answers_letter_order_key unique (letter_id, answer_order);
create index if not exists soul_trace_answers_user_email_idx
  on public.soul_trace_answers (user_email);

alter table public.soul_trace_legacy_links
  add primary key (letter_id);
create index if not exists soul_trace_legacy_links_user_email_idx
  on public.soul_trace_legacy_links (user_email);

create or replace function public.sync_soul_trace_legacy_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  linked_pet_id uuid;
  linked_submission_id uuid;
  account_user_id uuid;
begin
  select pet_id, submission_id into linked_pet_id, linked_submission_id
    from public.soul_trace_legacy_links where letter_id = new.letter_id;

  select id into account_user_id from auth.users
   where lower(email) = lower(new.user_email) and email_confirmed_at is not null
   order by created_at limit 1;
  if account_user_id is not null then
    insert into public.soul_trace_owners(user_id) values (account_user_id)
    on conflict (user_id) do update set verified_at = now();
  end if;

  if linked_submission_id is null then
    insert into public.soul_trace_pets(owner_user_id, pet_name, created_at)
    values (account_user_id, new.pet_name, new.created_at) returning pet_id into linked_pet_id;
    insert into public.soul_trace_submissions(
      pet_id, owner_user_id, letter_id, generated_letter, letter_title,
      letter_ending_phrase, letter_mode, personality_type, preferred_scenery,
      generation_locale, hero_image_url, hero_image_ref, created_at
    ) values (
      linked_pet_id, account_user_id, new.letter_id, new.generated_letter,
      new.letter_title, new.letter_ending_phrase, new.letter_mode,
      new.personality_type, new.preferred_scenery, new.generation_locale,
      new.hero_image_url, new.hero_image_ref, new.created_at
    ) returning submission_id into linked_submission_id;
    insert into public.soul_trace_legacy_links(user_email, pet_id, submission_id, letter_id)
    values (new.user_email, linked_pet_id, linked_submission_id, new.letter_id);
  else
    update public.soul_trace_pets set pet_name = new.pet_name,
      owner_user_id = coalesce(owner_user_id, account_user_id) where pet_id = linked_pet_id;
    update public.soul_trace_submissions set
      owner_user_id = coalesce(owner_user_id, account_user_id),
      generated_letter = new.generated_letter, letter_title = new.letter_title,
      letter_ending_phrase = new.letter_ending_phrase, letter_mode = new.letter_mode,
      personality_type = new.personality_type, preferred_scenery = new.preferred_scenery,
      generation_locale = new.generation_locale, hero_image_url = new.hero_image_url,
      hero_image_ref = new.hero_image_ref
    where submission_id = linked_submission_id;
  end if;
  return new;
end;
$$;

create trigger sync_soul_trace_legacy_profile_trigger
after insert or update of pet_name, personality_type, generated_letter,
  letter_title, letter_ending_phrase, letter_mode, preferred_scenery,
  generation_locale, hero_image_url, hero_image_ref, letter_id
on public.soul_trace_profiles for each row execute function public.sync_soul_trace_legacy_profile();

create or replace function public.sync_soul_trace_legacy_answer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare linked_submission_id uuid;
begin
  if tg_op = 'DELETE' then
    select submission_id into linked_submission_id from public.soul_trace_legacy_links
     where letter_id = old.letter_id;
    delete from public.soul_trace_submission_answers
     where submission_id = linked_submission_id and answer_order = old.answer_order;
    return old;
  end if;
  select submission_id into linked_submission_id from public.soul_trace_legacy_links
   where letter_id = new.letter_id;
  if linked_submission_id is not null then
    insert into public.soul_trace_submission_answers(submission_id, answer_order, question, answer)
    values (linked_submission_id, new.answer_order, new.question, new.answer)
    on conflict (submission_id, answer_order) do update
      set question = excluded.question, answer = excluded.answer;
  end if;
  return new;
end;
$$;

create trigger sync_soul_trace_legacy_answer_trigger
after insert or update or delete on public.soul_trace_answers
for each row execute function public.sync_soul_trace_legacy_answer();
