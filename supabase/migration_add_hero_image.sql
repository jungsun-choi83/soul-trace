-- 기존 DB에 한 번만 실행하세요.
alter table public.soul_trace_profiles
  add column if not exists hero_image_url text;

comment on column public.soul_trace_profiles.hero_image_url is 'DALL-E 3 생성 배경 이미지 URL';
