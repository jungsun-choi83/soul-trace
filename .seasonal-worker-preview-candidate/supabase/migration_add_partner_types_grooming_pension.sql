-- 제휴 유형 확장: 미용(GROOMING) · 펜션(PENSION)
-- partners.partner_type CHECK 가 HOSPITAL/FUNERAL 만 허용하던 것을 넓힌다.
-- 코드(lib/partner.ts)와 함께 배포해야 한다 — 코드만 바꾸면 DB 가 insert 를 막는다.
-- 기존 행은 갱신하거나 다시 만들지 않는다. 제약 조건의 허용 집합만 넓히므로
-- HOSPITAL/FUNERAL 파트너의 ID, 코드, 연락처, 상태, 정산 값은 그대로 보존된다.

alter table public.partners
  drop constraint if exists partners_partner_type_check,
  add constraint partners_partner_type_check
  check (partner_type in ('HOSPITAL', 'FUNERAL', 'GROOMING', 'PENSION'));
