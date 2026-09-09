-- Phase 5: save the presentation fields needed to restore the existing result
-- design without regenerating, translating, or guessing parts of a letter.

alter table public.soul_trace_profiles
  add column if not exists letter_title text,
  add column if not exists letter_ending_phrase text,
  add column if not exists letter_mode text;

alter table public.soul_trace_profiles
  drop constraint if exists soul_trace_profiles_letter_mode_check;
alter table public.soul_trace_profiles
  add constraint soul_trace_profiles_letter_mode_check
  check (letter_mode is null or letter_mode in ('living', 'memorial'));

alter table public.soul_trace_submissions
  add column if not exists letter_title text,
  add column if not exists letter_ending_phrase text,
  add column if not exists letter_mode text;

alter table public.soul_trace_submissions
  drop constraint if exists soul_trace_submissions_letter_mode_check;
alter table public.soul_trace_submissions
  add constraint soul_trace_submissions_letter_mode_check
  check (letter_mode is null or letter_mode in ('living', 'memorial'));

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
      pet_id, letter_id, generated_letter, letter_title, letter_ending_phrase,
      letter_mode, personality_type, preferred_scenery, generation_locale,
      hero_image_url, hero_image_ref, created_at
    ) values (
      linked_pet_id, new.letter_id, new.generated_letter, new.letter_title,
      new.letter_ending_phrase, new.letter_mode, new.personality_type,
      new.preferred_scenery, new.generation_locale, new.hero_image_url,
      new.hero_image_ref, new.created_at
    ) returning submission_id into linked_submission_id;

    insert into public.soul_trace_legacy_links (
      user_email, pet_id, submission_id, letter_id
    ) values (
      new.user_email, linked_pet_id, linked_submission_id, new.letter_id
    );
  else
    update public.soul_trace_pets set pet_name = new.pet_name
     where pet_id = linked_pet_id;

    update public.soul_trace_submissions
       set letter_id = new.letter_id,
           generated_letter = new.generated_letter,
           letter_title = new.letter_title,
           letter_ending_phrase = new.letter_ending_phrase,
           letter_mode = new.letter_mode,
           personality_type = new.personality_type,
           preferred_scenery = new.preferred_scenery,
           generation_locale = new.generation_locale,
           hero_image_url = new.hero_image_url,
           hero_image_ref = new.hero_image_ref
     where submission_id = linked_submission_id;

    update public.soul_trace_legacy_links set letter_id = new.letter_id
     where user_email = new.user_email;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_soul_trace_legacy_profile_trigger
  on public.soul_trace_profiles;
create trigger sync_soul_trace_legacy_profile_trigger
after insert or update of pet_name, personality_type, generated_letter,
  letter_title, letter_ending_phrase, letter_mode, preferred_scenery,
  generation_locale, hero_image_url, hero_image_ref, letter_id
on public.soul_trace_profiles
for each row execute function public.sync_soul_trace_legacy_profile();

-- Copy newly available fields into existing normalized submissions.
update public.soul_trace_submissions submissions
   set letter_title = profiles.letter_title,
       letter_ending_phrase = profiles.letter_ending_phrase,
       letter_mode = profiles.letter_mode
  from public.soul_trace_legacy_links links
  join public.soul_trace_profiles profiles using (user_email)
 where submissions.submission_id = links.submission_id;

comment on column public.soul_trace_submissions.letter_title is
  'Exact generated result title; never regenerated during interface language changes.';
comment on column public.soul_trace_submissions.letter_ending_phrase is
  'Exact explicit ending phrase used by the existing result design.';
