-- 첫 Soul Trace 등록(프로필 최초 저장) 시 환영 메일 1회 발송 표시.
-- NULL = 아직 안 보냄. timestamptz = 보낸 시각(또는 발송 시도 선점 시각).

alter table public.soul_trace_profiles
  add column if not exists welcome_email_sent_at timestamptz;

comment on column public.soul_trace_profiles.welcome_email_sent_at is
  'Soul Trace 첫 등록 환영 메일(Eternal Beam 링크 포함)을 보낸 시각. NULL이면 미발송.';
