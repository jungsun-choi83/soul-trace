# SoulTrace 기준 감리

**기준 커밋:** `2447c38f8ae400bb984d1b1e220006a13df456bd` (`master`, Merge pull request #59)  
**검토일:** 2026-10-31  
**방법:** 이 저장소의 소스와 SQL만 읽었다. 운영 Supabase에 접속하지 않았고, 운영 사이트나 운영 데이터베이스는 변경하지 않았다. Git에 SQL 파일이 있다는 사실만으로 그 마이그레이션이 운영에 적용됐다고 보지 않는다.

## 배포 규칙

감리 시점의 `.cursor/rules/auto-commit-deploy.mdc`는 작업이 끝나면 `master`에 커밋하고 `origin/master`로 푸시한 뒤 Vercel 운영 배포를 요구했다. 그 규칙은 `docs/rule-backups/auto-commit-deploy.mdc.bak`에 보관했고, 같은 브랜치에서 승인 없는 운영 배포를 금지하는 규칙으로 교체했다. 이 교체는 코드 배포가 아니다.

## 구현되어 있는 것

| 영역 | 근거 | 상태 |
|---|---|---|
| 홈, 한/영, 편지 시작 | `app/page.tsx`, `components/homepage/hero.tsx`, `locales/ko.json`, `locales/en.json` | 메인 CTA는 편지 흐름(`/choose`)이다. |
| 살아 있는 아이 / 추모 편지 | `app/living/page.tsx`, `app/memorial/page.tsx`, `app/choose/page.tsx` | 편지 모드 분기가 있다. |
| 편지 생성 | `app/api/generate-letter/route.ts` | 유지 대상. 이 감리는 프롬프트를 바꾸지 않는다. |
| 계정 인증 | `app/auth/page.tsx`, `lib/auth-redirect.ts`, `lib/supabase-auth-server.ts` | 세션 사용자와 `returnTo` 경로 검사가 있다. |
| 반려동물·제출 모델 | `supabase/migration_add_life_archive_foundation.sql` | `soul_trace_pets`는 `pet_id`, `owner_user_id`, `pet_name`, `created_at`만 있다. `soul_trace_submissions`는 편지 본문이 있는 제출이다. |
| 아카이브 화면 | `app/life-archive/page.tsx` | 펫과 제출이 둘 다 있어야 열린다. 없으면 `selection-required`다. |
| 글 기록 | `app/api/life-archive/memories/route.ts`, `supabase/migration_enable_life_archive_memory_writes.sql` | `submission_id`가 있고, 그 제출의 소유자만 쓴다. |
| 사진 | `app/api/life-archive/photos/route.ts`, `supabase/migration_add_life_archive_photos.sql` | 1~5장, JPEG/PNG/WEBP, 장당 10MB. 비공개 버킷 `life-archive-photos`. 첫 폴더가 `auth.uid()`다. |
| 영상 | `app/api/life-archive/videos/route.ts`, `supabase/migration_account_archive_persistence.sql` | 30초, 50MB. 제출에 묶인다. |
| 임시 브라우저 저장 | `lib/life-archive-temporary.ts`, `lib/temporary-photo-archive-indexeddb.ts` | `sessionStorage`와 IndexedDB다. 서버 영구 저장이 아니다. |
| Eternal Beam 편지 전달 | `app/api/handoff/route.ts`, `app/api/internal/letter/route.ts` | 편지 한 통의 일회용 전달이다. 아카이브 전체 동기화가 아니다. |
| 기기 설정 조회 | `app/api/customer-data/route.ts` | `x-eb-service-token`이 없으면 거절한다. 공개 동기화 API가 아니다. |
| 편지 공유 | `app/api/letter-share/route.ts`, `supabase/migration_letter_shares.sql` | 해시 토큰과 만료가 있다. |
| 시즌 폴라로이드 | `app/polaroid/page.tsx`, `app/api/seasonal-polaroid/route.ts` | 별도 기능으로 들어가 있다. |
| 기능 플래그 | `.env.example`, `app/life-archive/page.tsx` | `NEXT_PUBLIC_LIFE_ARCHIVE_SECURE_MODE`, `NEXT_PUBLIC_SKIP_RESULT_HERO_IMAGE`가 있다. 편지 없는 등록 플래그는 감리 시점에 없었다. |

## 없는 것

- 편지 제출 없이 반려동물을 만드는 화면과 API. `soul_trace_pets`의 RLS는 본인 조회만 허용한다 (`migration_add_life_archive_foundation.sql`의 select 정책). 인증 사용자의 insert 정책은 없다.
- `pet_id`만으로 사진·영상·글을 저장하는 테이블. 기존 `life_archive_memories`, `life_archive_photo_moments`, `life_archive_videos`는 `submission_id`가 필수이고 제출 행을 참조한다.
- 결제, 환불, 상품 가격 테이블. `lib/site-url.test.ts`는 공개 문구가 결제를 주장하지 않는지 본다. 저장소에서 결제 SDK 구현은 보이지 않았다.
- 가족 초대, 월간 회고 카드, 감정 기록, 목걸이 연동, Eternal Beam으로의 선택 내보내기.
- 이 저장소 안의 `soultrace-memory-shop` 코드. `lib/memory-shop-url.ts`는 `2447c38`에서 빠져 있다. 쇼핑몰 저장소는 범위 밖이다.

## 보안과 데이터

- API가 받은 `owner_user_id`를 소유권으로 쓰면 안 된다. 기존 사진 API는 세션 사용자와 그 사용자의 제출을 같이 확인한다.
- 펫을 지우면 `soul_trace_submissions.pet_id`가 `on delete cascade`라 편지도 지워진다. 펫 삭제 API를 만들면 기존 편지가 사라진다.
- 추모 상태는 별도 컬럼이 없다. 추모는 편지 모드 경로로만 갈라져 있다.
- 운영 DB에 위 SQL이 실제로 적용됐는지는 이 감리로 확인하지 않았다. 적용 여부는 읽기 전용 스키마 조회가 따로 필요하다.
- 핸드오프 토큰과 서비스 토큰을 아카이브 전체 권한으로 넓히면 안 된다.

## 테스트와 운영

- `npm test`는 `lib/*.test.ts`만 실행한다. `supabase/tests/*.sql`은 그 명령에 포함되지 않는다.
- 이 문서를 쓰는 동안 운영 배포, `master` 푸시, 운영 마이그레이션은 하지 않았다.

## 감리 뒤에 같은 브랜치에서 착수한 작업

`feature/pet-first-archive`에서 P0만 추가했다. `NEXT_PUBLIC_PET_FIRST_ARCHIVE`의 기본값은 꺼짐이다. `supabase/migration_pet_first_archive.sql`은 저장소에만 있고 운영에 적용하지 않았다. 기존 편지·사진·영상 테이블의 행은 옮기거나 지우지 않는다.
