-- Account-level Life Archive discovery, stable pet reuse, normalized channels,
-- and private video persistence. Additive and safe for existing archive rows.

alter table public.soul_trace_profiles
  add column if not exists pet_id uuid references public.soul_trace_pets (pet_id) on delete set null,
  add column if not exists service_channel text;
alter table public.soul_trace_profiles drop constraint if exists soul_trace_profiles_service_channel_check;
alter table public.soul_trace_profiles add constraint soul_trace_profiles_service_channel_check
  check (service_channel is null or service_channel in ('pension', 'grooming', 'hospital', 'funeral'));

alter table public.soul_trace_submissions add column if not exists service_channel text;
alter table public.soul_trace_submissions drop constraint if exists soul_trace_submissions_service_channel_check;
alter table public.soul_trace_submissions add constraint soul_trace_submissions_service_channel_check
  check (service_channel is null or service_channel in ('pension', 'grooming', 'hospital', 'funeral'));

-- The foundation schema allowed only one legacy link per pet. Stable pet identity
-- requires many letter/submission links to point at the same pet.
alter table public.soul_trace_legacy_links
  drop constraint if exists soul_trace_legacy_links_pet_id_key;

update public.soul_trace_profiles profiles
   set service_channel = lower(partners.partner_type)
  from public.partners partners
 where profiles.partner_id = partners.partner_id
   and profiles.service_channel is null
   and partners.partner_type in ('PENSION', 'GROOMING', 'HOSPITAL', 'FUNERAL');

update public.soul_trace_submissions submissions
   set service_channel = profiles.service_channel
  from public.soul_trace_profiles profiles
 where submissions.letter_id = profiles.letter_id
   and submissions.service_channel is null
   and profiles.service_channel is not null;

create index if not exists soul_trace_submissions_owner_pet_created_idx
  on public.soul_trace_submissions (owner_user_id, pet_id, created_at desc);
create index if not exists soul_trace_submissions_service_channel_idx
  on public.soul_trace_submissions (service_channel)
  where service_channel is not null;

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
    if new.pet_id is not null and account_user_id is not null then
      select pets.pet_id into linked_pet_id from public.soul_trace_pets pets
       where pets.pet_id = new.pet_id and pets.owner_user_id = account_user_id;
      if linked_pet_id is null then
        raise exception 'Selected pet does not belong to the authenticated owner';
      end if;
    else
      insert into public.soul_trace_pets(owner_user_id, pet_name, created_at)
      values (account_user_id, new.pet_name, new.created_at) returning pet_id into linked_pet_id;
    end if;

    insert into public.soul_trace_submissions(
      pet_id, owner_user_id, letter_id, generated_letter, letter_title,
      letter_ending_phrase, letter_mode, service_channel, personality_type,
      preferred_scenery, generation_locale, hero_image_url, hero_image_ref, created_at
    ) values (
      linked_pet_id, account_user_id, new.letter_id, new.generated_letter,
      new.letter_title, new.letter_ending_phrase, new.letter_mode,
      new.service_channel, new.personality_type, new.preferred_scenery,
      new.generation_locale, new.hero_image_url, new.hero_image_ref, new.created_at
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
      service_channel = new.service_channel, personality_type = new.personality_type,
      preferred_scenery = new.preferred_scenery,
      generation_locale = new.generation_locale, hero_image_url = new.hero_image_url,
      hero_image_ref = new.hero_image_ref
    where submission_id = linked_submission_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_soul_trace_legacy_profile_trigger on public.soul_trace_profiles;
create trigger sync_soul_trace_legacy_profile_trigger
after insert or update of pet_name, pet_id, personality_type, generated_letter,
  letter_title, letter_ending_phrase, letter_mode, service_channel,
  preferred_scenery, generation_locale, hero_image_url, hero_image_ref, letter_id
on public.soul_trace_profiles for each row execute function public.sync_soul_trace_legacy_profile();

create table if not exists public.life_archive_videos (
  video_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete cascade,
  submission_id uuid not null,
  storage_path text not null unique,
  caption text,
  memory_date date,
  content_type text not null check (content_type in ('video/mp4', 'video/webm', 'video/quicktime')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  duration_seconds numeric check (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 30)),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (submission_id, pet_id, owner_user_id)
    references public.soul_trace_submissions (submission_id, pet_id, owner_user_id)
    on delete cascade
);
create index if not exists life_archive_videos_archive_idx
  on public.life_archive_videos (owner_user_id, pet_id, submission_id, created_at desc);
alter table public.life_archive_videos enable row level security;
drop policy if exists "life archive videos owner access" on public.life_archive_videos;
create policy "life archive videos owner access" on public.life_archive_videos
  for all to authenticated using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid() and exists (
      select 1 from public.soul_trace_submissions submissions
       where submissions.submission_id = life_archive_videos.submission_id
         and submissions.pet_id = life_archive_videos.pet_id
         and submissions.owner_user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('life-archive-videos', 'life-archive-videos', false, 52428800,
  array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 52428800,
  allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime'];

drop policy if exists "life archive video storage owner read" on storage.objects;
create policy "life archive video storage owner read" on storage.objects for select to authenticated
  using (bucket_id = 'life-archive-videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "life archive video storage owner upload" on storage.objects;
create policy "life archive video storage owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'life-archive-videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "life archive video storage owner delete" on storage.objects;
create policy "life archive video storage owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'life-archive-videos' and (storage.foldername(name))[1] = auth.uid()::text);
