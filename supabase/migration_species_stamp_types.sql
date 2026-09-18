-- Preserve uploaded-photo stamps while allowing species-specific fallback stamps.
alter table public.soul_trace_profiles
  drop constraint if exists soul_trace_profiles_stamp_type_check;

-- Existing paw rows represent the neutral fallback until a new questionnaire
-- submission records its selected pet type.
update public.soul_trace_profiles
set stamp_type = 'paw_other'
where stamp_type = 'paw';

alter table public.soul_trace_profiles
  add constraint soul_trace_profiles_stamp_type_check
  check (stamp_type in ('photo', 'paw_dog', 'paw_cat', 'paw_rabbit', 'paw_hamster', 'paw_bird', 'paw_other'));

alter table public.soul_trace_profiles
  alter column stamp_type set default 'paw_other';
