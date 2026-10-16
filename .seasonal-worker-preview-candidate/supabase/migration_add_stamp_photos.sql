alter table public.soul_trace_profiles
  add column if not exists stamp_type text not null default 'paw_other'
    check (stamp_type in ('photo', 'paw_dog', 'paw_cat', 'paw_rabbit', 'paw_hamster', 'paw_bird', 'paw_other')),
  add column if not exists stamp_photo_ref text;

insert into storage.buckets (id, name, public)
values ('soul-trace-stamp-photos', 'soul-trace-stamp-photos', false)
on conflict (id) do update set public = false;
