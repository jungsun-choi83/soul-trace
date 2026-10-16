-- Phase 10.5 / 스텝 2 — answer_order 범위를 코드와 맞춘다 (1..5 → 1..8).
--
-- ── 왜 필요한가 ─────────────────────────────────────────────────────────────
-- schema.sql 은 `check (answer_order between 1 and 5)` 로 만들어졌는데,
-- 코드는 **8개**를 쓴다: 기억 5문항 + 톤 3문항 (lib/survey.ts buildSurveyAnswers,
-- app/api/generate-letter/route.ts 의 `answers.length !== 8` 가드).
--
-- 이 어긋남은 조용히 실패한다:
--   1. soul_trace_profiles upsert 가 **먼저** 성공한다 → 편지는 저장된다
--   2. soul_trace_answers 의 기존 행을 delete 한다   → 예전 답변이 지워진다
--   3. 8행 insert 가 6·7·8 에서 CHECK 위반으로 실패  → 답변이 하나도 안 남는다
--   4. 스트리밍 경로에서는 이 실패가 console.error 로만 남는다(route.ts) →
--      사용자는 편지를 정상적으로 받고, 아무도 눈치채지 못한다
--
-- 즉 **편지는 무사하지만 답변은 유실된다.** 이 마이그레이션은 그것만 고친다.
--
-- ── 하지 않는 것 ────────────────────────────────────────────────────────────
-- 편지 생성 동작을 바꾸지 않는다. 기존 generated_letter 를 건드리지 않는다.
-- 이미 유실된 과거 답변을 복구하지는 못한다 — 복구할 원본이 없다.

-- 제약 이름이 다를 수 있다(수동 변경 이력이 있다면). answer_order 를 참조하는
-- CHECK 제약을 이름과 무관하게 모두 걷어 낸 뒤, 하나만 다시 세운다.
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
    execute format(
      'alter table public.soul_trace_answers drop constraint %I', c.conname
    );
    raise notice 'dropped check constraint %', c.conname;
  end loop;
end $$;

alter table public.soul_trace_answers
  add constraint soul_trace_answers_answer_order_check
  check (answer_order between 1 and 8);

comment on column public.soul_trace_answers.answer_order is
  '1..8 — 기억 5문항 + 톤 3문항 (lib/survey.ts buildSurveyAnswers 와 같은 순서)';
