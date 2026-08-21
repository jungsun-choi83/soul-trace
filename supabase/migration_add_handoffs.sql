-- Phase 10.5 — Eternal Beam 핸드오프 능력(capability).
--
-- ── 무엇을 위한 표인가 ──────────────────────────────────────────────────────
-- Soul Trace 는 로그인이 없다. 세션도 쿠키도 없다. 그래서 "이 브라우저가 이 편지를
-- 넘길 자격이 있다"를 증명할 기존 수단이 **하나도 없다.** 이 표가 그 증명을 만든다.
--
-- 토큰은 편지 하나만 가리키고, 15분 뒤 죽고, 한 번만 쓰인다. 그 셋이 모두
-- 있어야 의미가 있다:
--   * 편지 하나만  — 토큰이 유출돼도 다른 편지로 번지지 않는다
--   * 15분        — URL 은 히스토리·리퍼러·채팅에 남는다. 오래 살면 안 된다
--   * 한 번만     — 남이 링크를 주워도 정당한 사용자가 이미 썼다면 소용없다
--
-- ── 원문 토큰을 저장하지 않는 이유 ──────────────────────────────────────────
-- 이 표가 유출돼도 토큰을 되살릴 수 없어야 한다. sha256 해시만 둔다. 원문은
-- 발급 응답에 **한 번** 실려 나가고 서버 어디에도 남지 않는다.
-- (Eternal Beam 의 shaker_shares 가 쓰는 것과 같은 방식이다.)
--
-- ── 소비가 원자적인 이유 ────────────────────────────────────────────────────
-- 두 요청이 같은 토큰을 동시에 들고 오면 둘 다 통과해서는 안 된다.
--   update ... set consumed_at = now() where token_hash = $1 and consumed_at is null
-- 한 문장이라 행 잠금이 걸리고, 정확히 하나만 행을 얻는다. 읽고-확인하고-쓰는
-- 세 문장으로 나누면 그 사이에 경합이 들어온다.

create table if not exists public.soul_trace_handoffs (
  -- sha256(원문 토큰) hex. **원문은 저장하지 않는다.**
  token_hash  text primary key,
  -- 이 토큰이 넘길 수 있는 편지. 정확히 하나다.
  -- 편지가 지워지면 토큰도 함께 사라진다(고아 토큰을 남기지 않는다).
  letter_id   uuid not null
    references public.soul_trace_profiles (letter_id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  -- 소비 감사 기록. null 이면 아직 쓰이지 않은 것이다.
  consumed_at timestamptz,
  -- 누가 가져갔는가 — Eternal Beam 의 canonical user_id.
  consumed_by text
);

-- 한 편지의 발급 이력을 훑는 경로(운영·디버깅).
create index if not exists soul_trace_handoffs_letter_idx
  on public.soul_trace_handoffs (letter_id);

-- 만료 청소용. 부분 인덱스라 이미 소비된 행은 들고 있지 않는다.
create index if not exists soul_trace_handoffs_expiry_idx
  on public.soul_trace_handoffs (expires_at)
  where consumed_at is null;

comment on table public.soul_trace_handoffs is
  'Eternal Beam 핸드오프 능력. 15분·1회용·편지 하나. 원문 토큰은 저장하지 않는다';
comment on column public.soul_trace_handoffs.token_hash is
  'sha256(원문) hex. 표가 유출돼도 토큰을 되살릴 수 없다';
comment on column public.soul_trace_handoffs.consumed_by is
  '소비한 Eternal Beam canonical user_id — 클레임 감사 기록';
