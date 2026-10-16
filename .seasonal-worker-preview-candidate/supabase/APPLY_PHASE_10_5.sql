-- ════════════════════════════════════════════════════════════════════════════
-- Phase 10.5 — Soul Trace 프로덕션에 한 번에 적용.
--
--   대상 프로젝트: pjoyuvqykggcuvbsnxio  (Soul Trace)
--   ⚠️ Eternal Beam(kdlukiujgclczwqmwvmk)이 아니다. 두 프로젝트는 별개이며
--      이 파일은 Soul Trace 쪽에서만 실행한다.
--
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여 넣고 실행한다.
-- 전체가 하나의 트랜잭션이다 — 중간에 실패하면 아무것도 남지 않는다.
-- 재실행해도 안전하다(idempotent).
--
-- 개별 파일과 내용이 같다:
--   migration_fix_answer_order_range.sql
--   migration_add_letter_identity.sql
--   migration_add_handoffs.sql
--
-- 적용 후 verify_phase_10_5.sql 로 A~E 를 확인한다.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. answer_order 1..5 → 1..8 ─────────────────────────────────────────────
-- 코드는 8개를 쓴다(기억 5 + 톤 3). 프로덕션 제약이 1..5 여서 8행 insert 가
-- 통째로 실패해 왔다 — 프로필(편지)은 저장되고 답변만 유실되는 조용한 실패다.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'soul_trace_answers'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%answer_order%'
  loop
    execute format('alter table public.soul_trace_answers drop constraint %I', c.conname);
    raise notice 'dropped check constraint %', c.conname;
  end loop;
end $$;

alter table public.soul_trace_answers
  add constraint soul_trace_answers_answer_order_check
  check (answer_order between 1 and 8);

comment on column public.soul_trace_answers.answer_order is
  '1..8 — 기억 5문항 + 톤 3문항 (lib/survey.ts buildSurveyAnswers 와 같은 순서)';

-- ── 2. letter_id / created_at ───────────────────────────────────────────────
-- user_email 은 PK 로 그대로 둔다. 핸드오프가 쓸 식별자만 새로 만든다:
-- DB 생성 UUID 라 추측 불가이고, PII 가 아니며, 사람이 아니라 편지를 가리킨다.
alter table public.soul_trace_profiles
  add column if not exists letter_id uuid;

update public.soul_trace_profiles
   set letter_id = gen_random_uuid()
 where letter_id is null;

alter table public.soul_trace_profiles alter column letter_id set default gen_random_uuid();
alter table public.soul_trace_profiles alter column letter_id set not null;

alter table public.soul_trace_profiles
  add column if not exists created_at timestamptz;

update public.soul_trace_profiles
   set created_at = now()
 where created_at is null;

alter table public.soul_trace_profiles alter column created_at set default now();
alter table public.soul_trace_profiles alter column created_at set not null;

create unique index if not exists soul_trace_profiles_letter_id_idx
  on public.soul_trace_profiles (letter_id);

comment on column public.soul_trace_profiles.letter_id is
  'Eternal Beam 핸드오프의 source_letter_id. DB 생성 UUID이며 재생성해도 보존된다';
comment on column public.soul_trace_profiles.created_at is
  '행 생성 시각. 마이그레이션 이전 행은 마이그레이션을 실행한 시각으로 백필됐다';

-- ── 3. 핸드오프 능력 ────────────────────────────────────────────────────────
-- 15분 · 1회용 · 편지 하나. 원문 토큰은 저장하지 않는다(sha256 해시만).
create table if not exists public.soul_trace_handoffs (
  token_hash  text primary key,
  letter_id   uuid not null
    references public.soul_trace_profiles (letter_id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  consumed_by text
);

create index if not exists soul_trace_handoffs_letter_idx
  on public.soul_trace_handoffs (letter_id);

create index if not exists soul_trace_handoffs_expiry_idx
  on public.soul_trace_handoffs (expires_at)
  where consumed_at is null;

comment on table public.soul_trace_handoffs is
  'Eternal Beam 핸드오프 능력. 15분·1회용·편지 하나. 원문 토큰은 저장하지 않는다';
comment on column public.soul_trace_handoffs.token_hash is
  'sha256(원문) hex. 표가 유출돼도 토큰을 되살릴 수 없다';
comment on column public.soul_trace_handoffs.consumed_by is
  '소비한 Eternal Beam canonical user_id — 클레임 감사 기록';

commit;

-- ── 적용 직후 확인 ──────────────────────────────────────────────────────────
-- missing_letter_id 는 0, distinct_letter_ids 는 total_rows 와 같아야 한다.
select
  count(*)                    as total_rows,
  count(letter_id)            as with_letter_id,
  count(*) - count(letter_id) as missing_letter_id,
  count(distinct letter_id)   as distinct_letter_ids,
  count(created_at)           as with_created_at
from public.soul_trace_profiles;

-- 1..8 로 바뀌었는지.
select pg_get_constraintdef(con.oid) as answer_order_check
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
 where rel.relname = 'soul_trace_answers' and con.contype = 'c';

-- 핸드오프 표가 생겼는지 (0 행이 정상).
select count(*) as handoff_rows from public.soul_trace_handoffs;
