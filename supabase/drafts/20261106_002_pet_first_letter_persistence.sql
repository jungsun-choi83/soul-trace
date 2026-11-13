-- Review-only migration draft. Do not run before approval.
--
-- Replaces only the profile-sync trigger function/trigger and tightens direct
-- write access to soul_trace_profiles. Application letter writes use the
-- server-only service-role client after the request is authenticated and its
-- selected Pet ID is checked by /api/generate-letter.

begin;

do $preflight$
declare
  required_column record;
begin
  if to_regclass('public.soul_trace_profiles') is null
     or to_regclass('public.soul_trace_pets') is null
     or to_regclass('public.soul_trace_owners') is null
     or to_regclass('public.soul_trace_submissions') is null
     or to_regclass('public.soul_trace_legacy_links') is null
     or to_regclass('auth.users') is null then
    raise exception 'Letter persistence prerequisite table is missing';
  end if;

  for required_column in
    select * from (values
      ('soul_trace_profiles', 'letter_id'),
      ('soul_trace_profiles', 'user_email'),
      ('soul_trace_profiles', 'pet_id'),
      ('soul_trace_profiles', 'pet_name'),
      ('soul_trace_profiles', 'personality_type'),
      ('soul_trace_profiles', 'generated_letter'),
      ('soul_trace_profiles', 'letter_title'),
      ('soul_trace_profiles', 'letter_ending_phrase'),
      ('soul_trace_profiles', 'letter_mode'),
      ('soul_trace_profiles', 'service_channel'),
      ('soul_trace_profiles', 'preferred_scenery'),
      ('soul_trace_profiles', 'generation_locale'),
      ('soul_trace_profiles', 'hero_image_url'),
      ('soul_trace_profiles', 'hero_image_ref'),
      ('soul_trace_profiles', 'created_at'),
      ('soul_trace_pets', 'pet_id'),
      ('soul_trace_pets', 'owner_user_id'),
      ('soul_trace_pets', 'pet_name'),
      ('soul_trace_pets', 'created_at'),
      ('soul_trace_owners', 'user_id'),
      ('soul_trace_submissions', 'submission_id'),
      ('soul_trace_submissions', 'pet_id'),
      ('soul_trace_submissions', 'owner_user_id'),
      ('soul_trace_submissions', 'letter_id'),
      ('soul_trace_submissions', 'generated_letter'),
      ('soul_trace_submissions', 'letter_title'),
      ('soul_trace_submissions', 'letter_ending_phrase'),
      ('soul_trace_submissions', 'letter_mode'),
      ('soul_trace_submissions', 'service_channel'),
      ('soul_trace_submissions', 'personality_type'),
      ('soul_trace_submissions', 'preferred_scenery'),
      ('soul_trace_submissions', 'generation_locale'),
      ('soul_trace_submissions', 'hero_image_url'),
      ('soul_trace_submissions', 'hero_image_ref'),
      ('soul_trace_submissions', 'created_at'),
      ('soul_trace_legacy_links', 'user_email'),
      ('soul_trace_legacy_links', 'pet_id'),
      ('soul_trace_legacy_links', 'submission_id'),
      ('soul_trace_legacy_links', 'letter_id'),
      ('users', 'id'),
      ('users', 'email'),
      ('users', 'email_confirmed_at')
    ) as required(table_name, column_name)
  loop
    if not exists (
      select 1 from information_schema.columns c
       where c.table_schema = case when required_column.table_name = 'users' then 'auth' else 'public' end
         and c.table_name = required_column.table_name
         and c.column_name = required_column.column_name
    ) then
      raise exception 'Required column is missing: %.%', required_column.table_name, required_column.column_name;
    end if;
  end loop;

  if not exists (select 1 from pg_roles where rolname = 'service_role')
     or not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'Expected Supabase API roles are missing';
  end if;

  if not exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.soul_trace_profiles'::regclass
       and t.tgname = 'sync_soul_trace_legacy_profile_trigger'
       and not t.tgisinternal
  ) then
    raise exception 'Expected legacy profile synchronization trigger is missing';
  end if;

  if to_regprocedure('public.sync_soul_trace_legacy_profile()') is null then
    raise exception 'Expected legacy profile synchronization function is missing';
  end if;

  if not exists (
    select 1 from pg_index i
     where i.indrelid = 'public.soul_trace_legacy_links'::regclass
       and i.indisunique and i.indisvalid and i.indnkeyatts = 1
       and pg_get_indexdef(i.indexrelid, 1, true) = 'letter_id'
  ) or not exists (
    select 1 from pg_index i
     where i.indrelid = 'public.soul_trace_legacy_links'::regclass
       and i.indisunique and i.indisvalid and i.indnkeyatts = 1
       and pg_get_indexdef(i.indexrelid, 1, true) = 'submission_id'
  ) then
    raise exception 'Legacy-link uniqueness by letter and submission is required';
  end if;

  if exists (
    select 1 from public.soul_trace_legacy_links l
     where l.letter_id is null or l.pet_id is null or l.submission_id is null
  ) then
    raise exception 'Legacy-link rows contain a missing letter, pet, or submission association';
  end if;
end;
$preflight$;

create or replace function public.sync_soul_trace_legacy_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_role text;
  account_user_id uuid;
  linked_user_email text;
  linked_pet_id uuid;
  linked_submission_id uuid;
  submission_pet_id uuid;
  pet_owner_user_id uuid;
  submission_owner_user_id uuid;
  inserted_pet_id uuid;
begin
  -- The public/authenticated API roles must never write these email-keyed
  -- records directly. The application writes through its server-only service
  -- client after Supabase auth and Pet ID ownership validation.
  caller_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.role(), ''),
    session_user::text
  );
  if caller_role not in ('service_role', 'postgres') then
    raise exception 'profile_sync_requires_trusted_server_role'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.letter_id is distinct from old.letter_id then
      raise exception 'letter_id_is_immutable'
        using errcode = '23514';
    end if;
    if lower(new.user_email) is distinct from lower(old.user_email) then
      raise exception 'letter_email_is_immutable'
        using errcode = '42501';
    end if;
    if old.pet_id is not null and new.pet_id is null then
      raise exception 'letter_pet_id_cannot_be_cleared'
        using errcode = '23514';
    end if;
  end if;

  -- Email is used only to map this trusted server write to the confirmed
  -- Supabase account. It is not accepted from anon/authenticated SQL callers.
  select u.id into account_user_id
    from auth.users u
   where lower(u.email) = lower(new.user_email)
     and u.email_confirmed_at is not null
   order by u.created_at, u.id
   limit 1;

  select l.pet_id, l.submission_id, l.user_email
    into linked_pet_id, linked_submission_id, linked_user_email
    from public.soul_trace_legacy_links l
   where l.letter_id = new.letter_id
   for update;

  if linked_submission_id is not null then
    if account_user_id is null then
      raise exception 'confirmed_letter_owner_required'
        using errcode = '42501';
    end if;
    if lower(linked_user_email) is distinct from lower(new.user_email) then
      raise exception 'existing_letter_email_owner_mismatch'
        using errcode = '42501';
    end if;

    select s.pet_id, s.owner_user_id
      into submission_pet_id, submission_owner_user_id
      from public.soul_trace_submissions s
     where s.submission_id = linked_submission_id
       and s.letter_id = new.letter_id
     for update;
    if not found then
      raise exception 'existing_letter_submission_link_is_inconsistent'
        using errcode = '23503';
    end if;
    if submission_pet_id is distinct from linked_pet_id then
      raise exception 'existing_letter_pet_link_is_inconsistent'
        using errcode = '23514';
    end if;

    select p.owner_user_id into pet_owner_user_id
      from public.soul_trace_pets p
     where p.pet_id = linked_pet_id
     for update;
    if not found then
      raise exception 'existing_letter_pet_is_missing'
        using errcode = '23503';
    end if;

    if new.pet_id is not null and new.pet_id is distinct from linked_pet_id then
      raise exception 'existing_letter_pet_reassociation_rejected'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and old.pet_id is not null
       and old.pet_id is distinct from linked_pet_id then
      raise exception 'stored_letter_pet_link_is_inconsistent'
        using errcode = '23514';
    end if;
    if account_user_id is not null
       and pet_owner_user_id is not null
       and pet_owner_user_id is distinct from account_user_id then
      raise exception 'existing_letter_pet_owner_mismatch'
        using errcode = '42501';
    end if;
    if account_user_id is not null
       and submission_owner_user_id is not null
       and submission_owner_user_id is distinct from account_user_id then
      raise exception 'existing_letter_submission_owner_mismatch'
        using errcode = '42501';
    end if;

    if account_user_id is not null then
      insert into public.soul_trace_owners (user_id)
      values (account_user_id)
      on conflict (user_id) do nothing;
    end if;

    -- Keep the existing pet_id and canonical pet_name. Only letter-owned
    -- result fields are synchronized on rerun/language change.
    update public.soul_trace_pets p
       set owner_user_id = coalesce(p.owner_user_id, account_user_id)
     where p.pet_id = linked_pet_id
       and (p.owner_user_id is null or p.owner_user_id = account_user_id);

    update public.soul_trace_submissions s
       set owner_user_id = coalesce(s.owner_user_id, account_user_id),
           generated_letter = new.generated_letter,
           letter_title = new.letter_title,
           letter_ending_phrase = new.letter_ending_phrase,
           letter_mode = new.letter_mode,
           service_channel = new.service_channel,
           personality_type = new.personality_type,
           preferred_scenery = new.preferred_scenery,
           generation_locale = new.generation_locale,
           hero_image_url = new.hero_image_url,
           hero_image_ref = new.hero_image_ref
     where s.submission_id = linked_submission_id
       and s.pet_id = linked_pet_id
       and (s.owner_user_id is null or s.owner_user_id = account_user_id);
    if not found then
      raise exception 'existing_letter_update_did_not_match_original_link'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if account_user_id is not null then
    insert into public.soul_trace_owners (user_id)
    values (account_user_id)
    on conflict (user_id) do nothing;
  end if;

  if new.pet_id is not null then
    if account_user_id is null then
      raise exception 'selected_pet_requires_confirmed_account'
        using errcode = '42501';
    end if;

    select p.pet_id, p.owner_user_id
      into inserted_pet_id, pet_owner_user_id
      from public.soul_trace_pets p
     where p.pet_id = new.pet_id
     for update;
    if not found or inserted_pet_id is distinct from new.pet_id then
      raise exception 'selected_pet_does_not_exist'
        using errcode = '23503';
    end if;
    if pet_owner_user_id is distinct from account_user_id then
      raise exception 'selected_pet_does_not_belong_to_confirmed_account'
        using errcode = '42501';
    end if;
    linked_pet_id := new.pet_id;
  else
    -- Preserve the legacy no-selected-pet path. It creates a new historical
    -- pet only when no canonical Pet ID was supplied.
    insert into public.soul_trace_pets (owner_user_id, pet_name, created_at)
    values (account_user_id, new.pet_name, new.created_at)
    returning pet_id into linked_pet_id;
  end if;

  insert into public.soul_trace_submissions (
    pet_id, owner_user_id, letter_id, generated_letter, letter_title,
    letter_ending_phrase, letter_mode, service_channel, personality_type,
    preferred_scenery, generation_locale, hero_image_url, hero_image_ref, created_at
  ) values (
    linked_pet_id, account_user_id, new.letter_id, new.generated_letter,
    new.letter_title, new.letter_ending_phrase, new.letter_mode,
    new.service_channel, new.personality_type, new.preferred_scenery,
    new.generation_locale, new.hero_image_url, new.hero_image_ref, new.created_at
  ) returning submission_id into linked_submission_id;

  insert into public.soul_trace_legacy_links (
    user_email, pet_id, submission_id, letter_id
  ) values (
    new.user_email, linked_pet_id, linked_submission_id, new.letter_id
  );

  return new;
end;
$function$;

alter function public.sync_soul_trace_legacy_profile() owner to postgres;
revoke all on function public.sync_soul_trace_legacy_profile() from public, anon, authenticated;
grant execute on function public.sync_soul_trace_legacy_profile() to service_role;

-- Browser roles cannot write legacy letter rows directly. Existing original
-- and consumer APIs use the server-only service_role client for these writes.
revoke insert, update, delete, truncate on table public.soul_trace_profiles
  from public, anon, authenticated;
grant select, insert, update on table public.soul_trace_profiles
  to service_role;

drop trigger if exists sync_soul_trace_legacy_profile_trigger
  on public.soul_trace_profiles;
create trigger sync_soul_trace_legacy_profile_trigger
after insert or update of
  pet_name, pet_id, personality_type, generated_letter,
  letter_title, letter_ending_phrase, letter_mode, service_channel,
  preferred_scenery, generation_locale, hero_image_url, hero_image_ref,
  letter_id, user_email
on public.soul_trace_profiles
for each row execute function public.sync_soul_trace_legacy_profile();

do $postflight$
begin
  if not has_table_privilege('service_role', 'public.soul_trace_profiles', 'SELECT')
     or not has_table_privilege('service_role', 'public.soul_trace_profiles', 'INSERT')
     or not has_table_privilege('service_role', 'public.soul_trace_profiles', 'UPDATE') then
    raise exception 'service_role letter persistence privileges were not preserved';
  end if;
  if has_table_privilege('anon', 'public.soul_trace_profiles', 'INSERT')
     or has_table_privilege('anon', 'public.soul_trace_profiles', 'UPDATE')
     or has_table_privilege('anon', 'public.soul_trace_profiles', 'DELETE')
     or has_table_privilege('authenticated', 'public.soul_trace_profiles', 'INSERT')
     or has_table_privilege('authenticated', 'public.soul_trace_profiles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.soul_trace_profiles', 'DELETE') then
    raise exception 'Untrusted browser roles still have direct profile write privileges';
  end if;
end;
$postflight$;

commit;
