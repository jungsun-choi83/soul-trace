# Soul Trace (Eternal Beam 사전 마케팅 앱)

떠나보낸 반려 아이에 대한 기억을 묻고, AI가 성향을 분석해 감성 편지와 배경 이미지를 만들어 주는
Next.js 앱입니다. 만들어진 편지는 인스타그램 스토리로 공유하거나, 일회용 토큰으로
**이터널빔 기기**에 그대로 넘길 수 있습니다.

- 프레임워크: Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4
- AI: OpenAI `gpt-4o`(편지) + `dall-e-3`(배경 이미지)
- 저장소: Supabase (Google 시트 백업은 선택)
- 언어: 한국어 / 영어 (`locales/ko.json`, `locales/en.json`)

## 1) 사용자 흐름

첫 화면에서 **아이가 지금 곁에 있는지** 먼저 묻습니다.

| 경로 | 갈래 | 편지 |
|------|------|------|
| `/` | 갈림길 | — |
| `/living` | 지금 곁에 있는 아이 | 오늘 하루를 들려주는 편지 |
| `/memorial` | 무지개 다리를 건넌 아이 | 마지막으로 전하지 못한 말 |

두 갈래는 같은 흐름을 씁니다 — **STEP 1** 프로필(이메일·아이 이름·함께한 기간 등) →
**STEP 2** 설문 → **STEP 3** 편지 톤 → 편지 생성(스트리밍) → 결과 화면 →
공유 / 이터널빔으로 이어가기. 화면 구현은 `components/soul-trace-flow.tsx` 하나이고
`mode` 프롭만 다릅니다.

갈리는 것은 **시제와 전제**입니다. 헤드라인, Q1·Q2, "헤어진 해" ↔ "지금 (올해)",
기억 5문항의 어미, 결과 편지 제목, 그리고 편지 프롬프트가 달라집니다.
살아 있는 갈래에는 "하늘·무지개다리 표현 빼기" 선택지가 **없습니다** — 살아 있는 아이에게
그걸 묻는 것 자체가 아이가 죽었다는 전제를 깔기 때문입니다. 프롬프트에서도 죽음·이별·
무지개다리 표현을 사용자의 선택과 무관하게 막습니다.

문구는 `locales/*.json` 의 `modes.living` / `modes.memorial` 에 모여 있고,
두 갈래가 어긋나지 않는지는 `lib/letter-mode.test.ts` 가 지킵니다.

설문은 총 **9단계**이고, DB에는 답변 **8개**가 저장됩니다.

| 단계 | 내용 | 저장 |
|------|------|------|
| 1–5 | 기억 질문 5문항 (5번째는 선택) | `answer_order` 1–5 |
| 6 | 영상용 사진 업로드 + 모션 선택 (건너뛰기 가능) | 저장 안 함 — 아래 "미구현" 참고 |
| 7–9 | 편지 톤 3문항 (분위기 / 추가 요청 / 길이) | `answer_order` 6–8 |

이메일 1개당 편지는 **1회**만 생성됩니다. 이메일 입력 직후와 최종 생성 시점에 각각 검사합니다.
결과 화면에서 언어를 바꾸면 편지만 그 언어로 다시 생성하고 배경 이미지는 재사용합니다.

## 2) 환경 변수

`.env.example`을 `.env.local`로 복사한 뒤 값을 채우세요. 각 항목의 의미는 그 파일 주석에 있습니다.

필수는 셋입니다.

```bash
OPENAI_API_KEY=...              # 없으면 편지 생성이 503
NEXT_PUBLIC_SUPABASE_URL=...    # 없으면 저장·중복검사·핸드오프가 동작하지 않음
SUPABASE_SERVICE_ROLE_KEY=...   # 서버 전용. 클라이언트 코드에 절대 노출 금지
```

이터널빔 연동을 쓰려면 하나 더 필요합니다.

```bash
SOUL_TRACE_SERVICE_TOKEN=...    # 소울트레이스와 이터널빔이 공유하는 유일한 비밀
```

> ⚠️ `SOUL_TRACE_SERVICE_TOKEN`에 `NEXT_PUBLIC_` 접두사를 붙이면 브라우저 번들에 박힙니다.
> 생성: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

## 3) Supabase 준비

**새 환경**이면 `supabase/schema.sql` 하나만 SQL Editor에서 실행하면 됩니다.
`soul_trace_profiles` · `soul_trace_answers` · `soul_trace_handoffs` 세 표가 모두 만들어집니다.

**이미 돌고 있는 DB**라면 `supabase/APPLY_PHASE_10_5.sql`을 통째로 붙여 넣어 실행하세요.
하나의 트랜잭션이고 재실행해도 안전합니다. 적용 뒤 `supabase/verify_phase_10_5.sql`로 A~E를 확인합니다.

> `APPLY_PHASE_10_5.sql`에는 **답변 유실 버그 수정**이 들어 있습니다. 예전 스키마의
> `answer_order` 제약이 `1..5`여서, 코드가 넣는 8행 insert가 통째로 실패하고 편지만 저장되고
> 답변은 조용히 사라져 왔습니다. 아직 적용하지 않았다면 지금도 답변이 쌓이지 않습니다.

개별 마이그레이션을 순서대로 돌려도 결과는 같습니다.

| 파일 | 내용 |
|------|------|
| `migration_add_hero_image.sql` | `hero_image_url` 추가 |
| `migration_fix_answer_order_range.sql` | `answer_order` 제약 `1..5` → `1..8` |
| `migration_add_letter_identity.sql` | `letter_id`(UUID) · `created_at` 추가 |
| `migration_add_handoffs.sql` | `soul_trace_handoffs` 표 생성 |

## 4) 로컬 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # lib/*.test.ts (핸드오프 토큰 단위 테스트)
npm run lint
npm run build
```

`NEXT_PUBLIC_SKIP_RESULT_HERO_IMAGE=1`을 켜면 배경 이미지 생성을 건너뛰어 대기 시간과 비용이
크게 줄어듭니다. 개발 중에 편합니다.

## 5) API

| 라우트 | 인증 | 용도 |
|--------|------|------|
| `POST /api/check-letter-eligibility` | 없음 | 이메일이 이미 편지를 받았는지 확인 |
| `POST /api/generate-letter` | 없음 | 편지·배경 이미지 생성 후 저장 |
| `POST /api/handoff` | 없음 (`letterId`가 곧 능력) | 일회용 핸드오프 토큰 발급 |
| `POST /api/internal/letter` | `X-EB-Service-Token` | 토큰을 소비하고 편지 본문 반환 (서버 대 서버) |
| `GET /api/customer-data` | `X-EB-Service-Token` | 이메일로 프로필 + 답변 8개 조회 (서버 대 서버) |
| `GET /api/proxy-hero-image` | 없음 | DALL·E 이미지 CORS 우회 프록시 (공유 카드 캡처용) |

### 편지 생성 — `POST /api/generate-letter`

입력: `userEmail`, `petName`, `preferredScenery`, `privacyConsent`, `answers`(8개), `tonePrefs`,
`locale`, `mode`, 선택적으로 `stream` / `skipImageGeneration` / `existingHeroImageUrl`.

`mode`는 `living` 또는 `memorial`이고, 없으면 `memorial`로 봅니다(이 필드가 생기기 전과 같은 동작).
편지 프롬프트의 전제와 마무리 문장이 이 값으로 갈립니다.

`stream: true`면 SSE로 편지를 한 글자씩 흘려보내고, 마지막 `done` 이벤트에 성향 분석과
`letterId`가 실려 옵니다. 저장은 `soul_trace_profiles` upsert(`user_email` 기준) +
`soul_trace_answers` 8행 재작성입니다. `GOOGLE_SHEETS_WEB_APP_URL`이 설정돼 있으면 같은 내용을
응답 이후 비동기로 시트에도 보냅니다.

## 6) 이터널빔 핸드오프

소울트레이스에는 로그인이 없습니다. "이 브라우저가 이 편지의 주인"임을 증명할 수단이 없으므로,
일회용 토큰이 그 자리를 대신합니다.

1. 편지를 저장하면 DB가 만든 `letter_id`(UUID)가 브라우저로 돌아옵니다. PII가 아닙니다.
2. 결과 화면 CTA가 `POST /api/handoff`로 **15분 · 1회용** 토큰을 발급받습니다.
   서버에는 sha256 해시만 남고 원문은 이 응답에 한 번만 실립니다.
3. 브라우저가 `…/soul-trace/import?traceId=…&handoff=…`로 이동합니다.
   이 URL만으로는 편지를 읽을 수 없습니다.
4. 이터널빔 서버가 공유 토큰을 붙여 `POST /api/internal/letter`를 호출해 본문을 교환합니다.
   넘어가는 것은 편지 본문과 아이 이름뿐입니다 — 이메일도 설문 답변도 넘기지 않습니다.

소비는 단일 UPDATE 문이라 원자적입니다. 같은 토큰이 두 번 통과하지 않고, 재사용은 409입니다.

배포 후 확인:

```bash
npx vercel env pull .env.verify --environment=production
# SOUL_TRACE_SERVICE_TOKEN 은 sensitive 라 pull 로 다시 읽히지 않습니다 — 직접 넘기세요.
SOUL_TRACE_SERVICE_TOKEN=... \
  node scripts/verify-handoff-e2e.mjs --base https://soultrace.eternalbeam.com
```

토큰 발급 → URL 안전성 → 서버 대 서버 교환 → 재사용 409까지 한 번에 확인합니다.
편지·프로필·답변을 만들거나 고치지 않는 읽기 위주 스크립트입니다.

> 편지를 실제로 받아 가는 이터널빔 쪽 import 화면은 **별도 저장소**에 있습니다.
> `soul_trace_handoffs` 표가 없거나 `letter_id`가 없으면 결과 화면의 CTA는 조용히 숨겨집니다.

## 7) 아직 구현되지 않은 것

- **사진 → 영상 생성.** 설문 6단계의 사진 업로드와 모션 선택은 브라우저 상태에만 남고
  어떤 API로도 전송되지 않습니다. 업로드 엔드포인트도 영상 생성도 없습니다.
  사진 동의 문구는 영상 생성을 전제로 쓰여 있으니, 방향이 정해지면 UI와 문구를 함께 정리해야 합니다.
- **연결되지 않은 컴포넌트.** `VideoGenerationSection`, `ResultEmailModal`, `ResultRewardSheet`,
  `BenefitBottomSheet`, `PrivacyConsentBlock`은 만들어져 있지만 어디서도 import하지 않습니다.
  관련 locale 문구도 함께 놀고 있습니다.
- **만료된 핸드오프 행 청소.** 부분 인덱스는 있지만 정리 작업(cron 등)은 없습니다.
- **편지 갈래를 DB에 남기지 않습니다.** `living`/`memorial`은 프롬프트에만 쓰이고
  `soul_trace_profiles`에는 저장되지 않습니다. 갈래별 통계가 필요해지면 nullable 컬럼과
  마이그레이션을 추가해야 합니다.

## 8) Vercel 배포 & 커스텀 도메인

1. [Vercel](https://vercel.com)에 저장소를 연결합니다.
2. **Settings → Environment Variables**에 `.env.example`의 값을 Production 기준으로 등록합니다.
   `SOUL_TRACE_SERVICE_TOKEN`은 Sensitive로 두고, 같은 값을 이터널빔 쪽에도 넣습니다.
3. **Settings → Domains**에 `soultrace.eternalbeam.com`을 추가합니다.
4. `eternalbeam.com` DNS에 Vercel이 알려 주는 정확한 대상으로 `CNAME soultrace`를 만듭니다.
   (대상 값은 프로젝트마다 다릅니다.)
5. SSL 발급까지 몇 분에서 최대 48시간이 걸릴 수 있습니다.

CLI로는 `npm run deploy:preview` / `npm run deploy:prod`를 쓸 수 있습니다.
