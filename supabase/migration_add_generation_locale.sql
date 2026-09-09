alter table public.soul_trace_profiles
  add column if not exists generation_locale text;

alter table public.soul_trace_profiles
  drop constraint if exists soul_trace_profiles_generation_locale_check;

alter table public.soul_trace_profiles
  add constraint soul_trace_profiles_generation_locale_check
  check (generation_locale is null or generation_locale in ('en', 'ko'));

comment on column public.soul_trace_profiles.generation_locale is
  'Locale used by the AI when generating generated_letter; included in generation identity.';
