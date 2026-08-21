-- Phase 10.5 검증 — Supabase SQL Editor 에서 **마이그레이션 이후** 실행한다.
--
-- 읽기 전용 검사(0~2)와, 격리된 픽스처로 도는 쓰기 검사(3)로 나뉜다.
-- 쓰기 검사는 전용 이메일만 건드리고 마지막에 스스로를 지운다 — 실제 고객
-- 데이터를 만들지도 바꾸지도 않는다.

-- ────────────────────────────────────────────────────────────────────────────
-- 0. 마이그레이션 전 실태 조사 (스텝 2 의 근거 — 마이그레이션 **전에** 찍어 두면 좋다)
-- ────────────────────────────────────────────────────────────────────────────

-- 현재 걸려 있는 answer_order CHECK 정의. 마이그레이션 후에는 1..8 이어야 한다.
select con.conname, pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
 where nsp.nspname = 'public'
   and rel.relname = 'soul_trace_answers'
   and con.contype = 'c';

-- 답변이 실제로 유실돼 왔는지. 코드는 항상 8개를 쓰므로, 프로덕션에 8이 아닌
-- 값이 많다면 CHECK 위반으로 insert 가 통째로 실패해 온 것이다.
select coalesce(a.cnt, 0) as answers_per_profile, count(*) as profiles
  from public.soul_trace_profiles p
  left join (
    select user_email, count(*) as cnt
      from public.soul_trace_answers
     group by user_email
  ) a on a.user_email = p.user_email
 group by 1
 order by 1;

-- ────────────────────────────────────────────────────────────────────────────
-- A. 기존 행이 UUID 를 받았는가 — null 도, 중복도 없어야 한다
-- ────────────────────────────────────────────────────────────────────────────
select
  count(*)                                            as total_rows,
  count(letter_id)                                    as with_letter_id,
  count(*) - count(letter_id)                         as missing_letter_id,   -- 0 이어야 한다
  count(distinct letter_id)                           as distinct_letter_ids, -- total_rows 와 같아야 한다
  count(created_at)                                   as with_created_at      -- total_rows 와 같아야 한다
from public.soul_trace_profiles;

-- 컬럼이 실제로 NOT NULL + DEFAULT 로 승격됐는가
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'soul_trace_profiles'
   and column_name in ('letter_id', 'created_at', 'user_email', 'generated_letter')
 order by column_name;

-- unique 인덱스가 존재하는가
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename  = 'soul_trace_profiles';

-- ────────────────────────────────────────────────────────────────────────────
-- 1. D 사전 스냅샷 — generated_letter 가 마이그레이션으로 바뀌지 않았음을 보이려면
--    마이그레이션 **전후** 로 같은 값이 나와야 한다. 두 번 찍어서 비교한다.
-- ────────────────────────────────────────────────────────────────────────────
select md5(string_agg(generated_letter, '' order by user_email)) as letters_fingerprint,
       count(*) as rows
  from public.soul_trace_profiles;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. 쓰기 검사 (B · C · D · E) — 격리된 픽스처, 끝나면 스스로 정리한다
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  fixture_email constant text := 'phase105.verify@eternalbeam.invalid';
  first_id  uuid;
  second_id uuid;
  first_letter  text;
  second_letter text;
  answer_rows int;
begin
  -- 앞선 실행이 남긴 것이 있으면 치운다 (answers 는 FK cascade 로 함께 지워진다)
  delete from public.soul_trace_profiles where user_email = fixture_email;

  -- ── B. 새 편지가 UUID 를 받는가 ──────────────────────────────────────────
  -- route.ts 의 upsert 와 **같은 컬럼 목록**으로 insert 한다: letter_id 는 없다.
  insert into public.soul_trace_profiles
    (user_email, pet_name, personality_type, generated_letter, preferred_scenery, hero_image_url)
  values
    (fixture_email, '검증이', '검증용 성향', '첫 번째 편지 본문', '검증용 풍경', null);

  select letter_id, generated_letter into first_id, first_letter
    from public.soul_trace_profiles where user_email = fixture_email;

  if first_id is null then
    raise exception 'B 실패: 새 행에 letter_id 가 부여되지 않았다';
  end if;
  raise notice 'B 통과 — 새 행 letter_id = %', first_id;

  -- ── E. 답변 1..8 이 모두 저장되는가 ──────────────────────────────────────
  -- 마이그레이션 전이라면 6·7·8 에서 CHECK 위반으로 여기서 예외가 난다.
  insert into public.soul_trace_answers (user_email, answer_order, question, answer)
  select fixture_email, i, format('Q%s', i), format('A%s', i)
    from generate_series(1, 8) as i;

  select count(*) into answer_rows
    from public.soul_trace_answers where user_email = fixture_email;

  if answer_rows <> 8 then
    raise exception 'E 실패: 답변이 8행이 아니라 %행 저장됐다', answer_rows;
  end if;
  raise notice 'E 통과 — 답변 8행 저장됨';

  -- ── C. 같은 이메일 재생성(언어 전환)이 letter_id 를 보존하는가 ───────────
  -- route.ts 의 `upsert(profileRow, { onConflict: "user_email" })` 와 같은 모양:
  -- 컬럼 목록에 letter_id 가 없다.
  insert into public.soul_trace_profiles
    (user_email, pet_name, personality_type, generated_letter, preferred_scenery, hero_image_url)
  values
    (fixture_email, '검증이', '검증용 성향(영문)', '두 번째 편지 본문', '검증용 풍경', null)
  on conflict (user_email) do update set
    pet_name          = excluded.pet_name,
    personality_type  = excluded.personality_type,
    generated_letter  = excluded.generated_letter,
    preferred_scenery = excluded.preferred_scenery,
    hero_image_url    = excluded.hero_image_url;

  select letter_id, generated_letter into second_id, second_letter
    from public.soul_trace_profiles where user_email = fixture_email;

  if second_id is distinct from first_id then
    raise exception 'C 실패: 재생성 후 letter_id 가 % → % 로 바뀌었다', first_id, second_id;
  end if;
  raise notice 'C 통과 — 재생성 후에도 letter_id = % 유지', second_id;

  -- ── D. 편지 본문은 upsert 가 준 값 그대로인가 (마이그레이션이 건드리지 않는다) ──
  if second_letter <> '두 번째 편지 본문' then
    raise exception 'D 실패: generated_letter 가 예상과 다르다 — %', second_letter;
  end if;
  if first_letter <> '첫 번째 편지 본문' then
    raise exception 'D 실패: 최초 generated_letter 가 예상과 달랐다 — %', first_letter;
  end if;
  raise notice 'D 통과 — generated_letter 는 애플리케이션이 쓴 값 그대로다';

  -- 정리
  delete from public.soul_trace_profiles where user_email = fixture_email;
  raise notice '픽스처 정리 완료 — A~E 검사 통과';
end $$;

-- 픽스처가 남지 않았는지 확인 (0 이어야 한다)
select count(*) as leftover_fixture_rows
  from public.soul_trace_profiles
 where user_email = 'phase105.verify@eternalbeam.invalid';
