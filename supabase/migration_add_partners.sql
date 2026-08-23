-- Phase 15 — 파트너 귀속 (동물병원 / 장례식장).
--
--   대상 프로젝트: pjoyuvqykggcuvbsnxio  (Soul Trace)
--
-- ── 왜 코드와 파트너를 나누는가 ─────────────────────────────────────────────
-- QR 에 찍히는 것은 **코드**이고, 우리가 정산하는 대상은 **파트너**다. 둘을 한
-- 테이블에 두면 코드를 바꿀 때마다 파트너가 새로 생긴다. 나누면:
--   * 한 병원이 지점·캠페인별로 여러 코드를 가질 수 있다
--   * 코드가 유출되면 그 코드만 끄면 된다 (파트너는 살아 있다)
--   * 이미 귀속된 편지는 코드가 꺼져도 파트너를 잃지 않는다
--
-- ── 왜 코드가 불투명해야 하는가 ─────────────────────────────────────────────
-- QR 은 공개된 종이에 찍힌다. 코드가 'seoul-vet-01' 처럼 읽히면 남의 코드를
-- 추측해 남의 병원에 귀속시킬 수 있다. 정산이 걸린 값이므로 추측 가능해서는
-- 안 된다 — 발급 시 무작위 문자열을 쓴다.
--
-- ── 귀속은 서버가 정한다 ────────────────────────────────────────────────────
-- 브라우저는 **코드**만 들고 온다. partner_id 는 서버가 코드를 조회해 붙인다.
-- 브라우저가 partner_id 를 보낼 수 있으면 누구나 아무 파트너에 귀속시킬 수 있다.

create table if not exists public.partners (
  partner_id  text primary key,
  -- HOSPITAL = 동물병원 / FUNERAL = 반려동물 장례식장
  partner_type text not null check (partner_type in ('HOSPITAL', 'FUNERAL')),
  partner_name text not null,
  -- 끄면 새 귀속이 생기지 않는다. **이미 귀속된 편지는 그대로 유지된다.**
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.partner_codes (
  -- QR/링크에 찍히는 불투명 코드. 추측 불가해야 한다.
  code        text primary key,
  partner_id  text not null references public.partners (partner_id) on delete cascade,
  -- 코드 단위로 끌 수 있다 (유출된 인쇄물 회수 등). 파트너는 살아 있다.
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists partner_codes_partner_idx
  on public.partner_codes (partner_id);

-- ── 편지에 귀속을 남긴다 ────────────────────────────────────────────────────
-- **nullable 이다.** 파트너 없이 직접 들어온 고객이 다수이고, 그들의 흐름은
-- 조금도 달라지지 않아야 한다. NULL = 직접 유입.
alter table public.soul_trace_profiles
  add column if not exists partner_id text
    references public.partners (partner_id) on delete set null;

create index if not exists soul_trace_profiles_partner_idx
  on public.soul_trace_profiles (partner_id)
  where partner_id is not null;

comment on table public.partners is
  '제휴 동물병원·장례식장. 정산 대상이며 코드와 분리돼 있다';
comment on table public.partner_codes is
  'QR 에 찍히는 불투명 코드. 파트너당 여러 개 가능하고 개별로 끌 수 있다';
comment on column public.soul_trace_profiles.partner_id is
  '서버가 코드로 확정한 귀속. NULL = 직접 유입. 브라우저 값은 신뢰하지 않는다';
