-- Phase 10.5 / 스텝 3 — 편지에 **안정적인 식별자**를 준다.
--
-- ── 왜 필요한가 ─────────────────────────────────────────────────────────────
-- 지금 soul_trace_profiles 의 유일한 식별자는 user_email(PK)이다. 그것을 Eternal
-- Beam 핸드오프의 source_letter_id 로 쓸 수 없다:
--   * 브라우저가 타이핑한 값이다 (서버가 만든 것이 아니다)
--   * 이메일이라 추측·열거가 쉽다
--   * PII 다 — URL 에 실으면 referer·로그·브라우저 기록에 고객 이메일이 남는다
--   * 편지가 아니라 **사람**을 가리킨다
--
-- letter_id 는 그 넷을 모두 해결한다: DB 가 만들고, 무작위 UUID 이며, PII 가
-- 아니고, 행 하나에 붙는다.
--
-- ── 유지되는 것 ─────────────────────────────────────────────────────────────
-- user_email PK 는 **그대로 둔다.** 지금 PK 를 바꾸면 soul_trace_answers 의 FK,
-- upsert 의 onConflict, check-letter-eligibility, customer-data 가 한꺼번에 흔들린다.
-- letter_id 는 unique 인덱스로 충분하다 — 핸드오프가 필요한 것은 "유일함"이지
-- "기본키임"이 아니다.
--
-- ── 언어 재생성이 letter_id 를 보존하는 이유 ────────────────────────────────
-- route.ts 의 upsert 는 컬럼 목록을 명시해서 보낸다(user_email, pet_name,
-- personality_type, generated_letter, preferred_scenery, [hero_image_url]).
-- letter_id 가 그 목록에 없으므로 ON CONFLICT DO UPDATE 는 letter_id 를 건드리지
-- 않는다. 즉 같은 이메일로 몇 번을 다시 생성해도 letter_id 는 처음 값 그대로다.
-- (verify_phase_10_5.sql 의 C 가 이것을 실제로 확인한다.)
--
-- ── 하지 않는 것 ────────────────────────────────────────────────────────────
-- generated_letter 를 읽지도 쓰지도 않는다. 편지 생성 동작을 바꾸지 않는다.
-- 재실행해도 안전하다(idempotent) — 이미 UUID 를 받은 행은 다시 채우지 않는다.

-- ── letter_id ────────────────────────────────────────────────────────────────
-- nullable 로 추가 → 백필 → NOT NULL 승격. 한 문장으로 몰지 않는 이유는
-- 중간에 끊겨도 다시 실행하면 이어서 끝나기 때문이다.
alter table public.soul_trace_profiles
  add column if not exists letter_id uuid;

-- 기존 행 백필. **행마다 다른 UUID** 가 들어간다 (gen_random_uuid 는 volatile).
update public.soul_trace_profiles
   set letter_id = gen_random_uuid()
 where letter_id is null;

alter table public.soul_trace_profiles
  alter column letter_id set default gen_random_uuid();

alter table public.soul_trace_profiles
  alter column letter_id set not null;

-- ── created_at ───────────────────────────────────────────────────────────────
-- 기존 행에는 진짜 생성 시각이 남아 있지 않다. now() 로 채우되, 그 값이 "이
-- 마이그레이션을 돌린 시각"이라는 점을 컬럼 코멘트에 남긴다 — 나중에 이 값을
-- 가입 시점으로 착각해 분석하지 않도록.
alter table public.soul_trace_profiles
  add column if not exists created_at timestamptz;

update public.soul_trace_profiles
   set created_at = now()
 where created_at is null;

alter table public.soul_trace_profiles
  alter column created_at set default now();

alter table public.soul_trace_profiles
  alter column created_at set not null;

-- ── 유일성 ───────────────────────────────────────────────────────────────────
-- 핸드오프는 letter_id 하나로 편지 한 통을 찾는다. unique 가 아니면 그 조회가
-- 여러 행을 만날 수 있고, 그때 어느 편지를 인쇄할지 결정할 근거가 없다.
create unique index if not exists soul_trace_profiles_letter_id_idx
  on public.soul_trace_profiles (letter_id);

comment on column public.soul_trace_profiles.letter_id is
  'Eternal Beam 핸드오프의 source_letter_id. DB 생성 UUID이며 재생성해도 보존된다';
comment on column public.soul_trace_profiles.created_at is
  '행 생성 시각. 마이그레이션 이전 행은 마이그레이션을 실행한 시각으로 백필됐다';
