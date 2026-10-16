-- Phase 16 — 파트너 정산 근거(share_rate) + QR 갈래(track).
--
--   대상 프로젝트: pjoyuvqykggcuvbsnxio  (Soul Trace)
--
-- Phase 15(migration_add_partners.sql)가 "어느 파트너인가"를 세웠다면, 여기서는
-- "얼마를 정산하는가"와 "그 QR 이 어느 갈래로 들어오는가"를 더한다.
-- 정산 **실행**은 아직 만들지 않는다 — 나중에 계산할 수 있을 만큼의 사실만 남긴다.

-- ── 정산 비율 ───────────────────────────────────────────────────────────────
-- **numeric 이다. float 이 아니다.** 0.15 는 이진 부동소수로 정확히 표현되지
-- 않는다. 금액에 곱해 합산하면 건당 반올림 오차가 쌓이고, 그 차이는 정산서에서
-- "왜 87원이 비냐"로 나타난다. 돈이 걸린 값은 십진 고정소수로 저장한다.
--
-- 범위를 0..1 로 못박는다. 15 를 15% 로 알고 넣는 실수를 DB 가 막아 준다 —
-- 그대로 통과하면 매출의 1500% 를 정산해야 한다.
alter table public.partners
  add column if not exists share_rate numeric(6, 4) not null default 0;

alter table public.partners
  drop constraint if exists partners_share_rate_range;
alter table public.partners
  add constraint partners_share_rate_range
  check (share_rate >= 0 and share_rate <= 1);

-- ── QR 갈래 ─────────────────────────────────────────────────────────────────
-- 병원 대기실에 붙는 QR 과 장례식장에 붙는 QR 은 **들어오는 사람이 다르다.**
-- 앞은 아직 곁에 있는 아이(living), 뒤는 이미 떠난 아이(memorial)다. 그 사실을
-- 코드에 박아 두면 고객이 첫 화면에서 자기 상황을 다시 고를 필요가 없다.
--
-- ⚠️ 새 개념이 아니다. 값은 Soul Trace 가 이미 쓰는 LetterMode 와 **같은 낱말**
--    ('living' | 'memorial', lib/letter-mode.ts)이다. 갈래를 두 벌 만들지 않는다.
--
-- nullable 이다. 기존 코드에는 track 이 없고, 없으면 예전처럼 고객이 첫 화면에서
-- 직접 고른다. 기존 인쇄물을 회수할 이유가 없다.
alter table public.partner_codes
  add column if not exists track text;

alter table public.partner_codes
  drop constraint if exists partner_codes_track_check;
alter table public.partner_codes
  add constraint partner_codes_track_check
  check (track is null or track in ('living', 'memorial'));

-- ── 어느 코드로 들어왔는가 ──────────────────────────────────────────────────
-- partner_id 만으로는 정산 단위가 부족하다. 한 병원이 지점·캠페인별로 여러 코드를
-- 갖는 것이 Phase 15 의 설계 전제였는데, 어느 코드가 이 고객을 데려왔는지 남지
-- 않으면 그 구분이 통계에서 사라진다.
--
-- FK 를 걸지 않는다. 코드는 회수·삭제될 수 있지만 **이미 귀속된 편지는 그때의
-- 사실을 잃으면 안 된다.** 정산은 주문 시점의 사실 위에서 이뤄진다.
alter table public.soul_trace_profiles
  add column if not exists partner_code text;

create index if not exists soul_trace_profiles_partner_code_idx
  on public.soul_trace_profiles (partner_code)
  where partner_code is not null;

comment on column public.partners.share_rate is
  '정산 비율 0..1 (0.15 = 15%). numeric — 돈 계산에 float 을 쓰지 않는다';
comment on column public.partner_codes.track is
  'QR 이 고정하는 갈래. lib/letter-mode.ts 의 LetterMode 와 같은 값. NULL = 고객이 직접 고른다';
comment on column public.soul_trace_profiles.partner_code is
  '이 고객을 데려온 코드. 파트너당 여러 코드를 구분하기 위한 것이며 FK 를 걸지 않는다';
