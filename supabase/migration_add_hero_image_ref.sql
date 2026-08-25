-- 기존 DB 에 한 번만 실행하세요. (Phase 24 — 히어로 이미지 영구 보관)
--
-- ── 왜 필요한가 ─────────────────────────────────────────────────────────────
-- hero_image_url 에 들어 있던 값은 DALL·E 가 돌려준 **임시 주소**다. 한두 시간이면
-- 죽는다. 고객이 편지를 보고 곧바로 Eternal Beam 으로 넘어가면 그쪽이 제때
-- 바이트를 복사하지만, 이틀 뒤에 넘어가면 원본은 이미 없다 — 편지 본문은 멀쩡한데
-- 실물 편지에서 배경만 사라진다.
--
-- 그래서 생성 직후 바이트를 우리 버킷에 넣고, **객체 경로**를 여기에 적는다.
-- 서명 URL 을 적지 않는 이유는 단순하다: 서명은 만료되고 경로는 만료되지 않는다.
--
-- hero_image_url 은 **지우지 않는다.** 보관 이전에 만들어진 편지들이 그 값만
-- 가지고 있고, 원본이 아직 살아 있는 동안에는 그대로 동작해야 한다.

alter table public.soul_trace_profiles
  add column if not exists hero_image_ref text;

comment on column public.soul_trace_profiles.hero_image_ref is
  'hero-images 버킷의 객체 경로(letters/<letter_id>/hero.png). 만료되지 않는 안정 참조 — 서명 URL 을 넣지 말 것.';


-- ── 비공개 버킷 ─────────────────────────────────────────────────────────────
-- public = false 다. 공개로 두면 letter_id 를 아는 사람은 누구나 배경을 받을 수
-- 있고, letter_id 는 핸드오프 경로에서 오가는 값이다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hero-images',
  'hero-images',
  false,
  12582912,  -- 12MB. 인쇄 배경 한 장이라 이보다 클 이유가 없다.
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ── 접근 정책 ───────────────────────────────────────────────────────────────
-- **정책을 하나도 만들지 않는다.** storage.objects 는 RLS 가 켜진 채로 오고,
-- 정책이 없으면 anon/authenticated 키로는 읽기도 쓰기도 불가능하다.
--
-- 쓰기는 서버(service_role)만 한다 — service_role 은 RLS 를 우회한다.
-- 읽기는 /api/internal/letter 가 그때그때 발급하는 짧은 서명 URL 로만 된다.
--
-- 여기에 "authenticated 는 insert 가능" 같은 정책을 추가하면 버킷이 곧바로
-- 쓰기 가능해진다. 그러지 말 것 — 이 버킷에 무언가를 넣는 주체는 서버뿐이다.
do $$
begin
  -- 과거에 열어 둔 정책이 있으면 걷어낸다(멱등 재실행 대비).
  execute 'drop policy if exists "hero_images_public_read" on storage.objects';
  execute 'drop policy if exists "hero_images_anon_write" on storage.objects';
end
$$;
