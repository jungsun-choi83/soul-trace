-- Life Archive photo moments. Additive only: temporary IndexedDB data is untouched.
create table if not exists public.life_archive_photo_moments (
  moment_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  pet_id uuid not null references public.soul_trace_pets (pet_id) on delete cascade,
  submission_id uuid not null,
  caption text,
  memory_date date,
  layout text not null default 'clean-grid' check (layout in ('classic-centre', 'clean-grid', 'scrapbook')),
  center_photo_id uuid,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (submission_id, pet_id, owner_user_id)
    references public.soul_trace_submissions (submission_id, pet_id, owner_user_id)
    on delete cascade,
  unique (moment_id, owner_user_id)
);

create table if not exists public.life_archive_photos (
  photo_id uuid primary key default gen_random_uuid(),
  moment_id uuid not null,
  owner_user_id uuid not null references public.soul_trace_owners (user_id) on delete cascade,
  storage_path text not null unique,
  photo_order integer not null check (photo_order between 0 and 4),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size > 0),
  created_at timestamptz not null default now(),
  unique (moment_id, photo_order),
  foreign key (moment_id, owner_user_id)
    references public.life_archive_photo_moments (moment_id, owner_user_id)
    on delete cascade
);

create index if not exists life_archive_photo_moments_archive_idx
  on public.life_archive_photo_moments (owner_user_id, pet_id, submission_id, created_at desc);
create index if not exists life_archive_photos_moment_idx
  on public.life_archive_photos (moment_id, photo_order);

alter table public.life_archive_photo_moments enable row level security;
alter table public.life_archive_photos enable row level security;

drop policy if exists "life archive photo moments owner access" on public.life_archive_photo_moments;
create policy "life archive photo moments owner access"
  on public.life_archive_photo_moments for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "life archive photos owner access" on public.life_archive_photos;
create policy "life archive photos owner access"
  on public.life_archive_photos for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('life-archive-photos', 'life-archive-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "life archive photo storage owner read" on storage.objects;
create policy "life archive photo storage owner read"
  on storage.objects for select to authenticated
  using (bucket_id = 'life-archive-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "life archive photo storage owner upload" on storage.objects;
create policy "life archive photo storage owner upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'life-archive-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "life archive photo storage owner delete" on storage.objects;
create policy "life archive photo storage owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'life-archive-photos' and (storage.foldername(name))[1] = auth.uid()::text);
