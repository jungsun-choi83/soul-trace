# Soul Trace (Eternal Beam 사전 마케팅 앱)

반려 아이의 성향 테스트 5문항을 입력하면 AI가 성향을 분석하고 감성 편지를 생성하는 Next.js 앱입니다.

## 1) 환경 변수 설정

루트에 `.env.local` 파일을 만들고 아래를 입력하세요.

```bash
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=https://soultrace.eternalbeam.com
```

> `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용입니다. 클라이언트 코드에 절대 노출하지 마세요.

## 2) Supabase 테이블 생성

Supabase SQL Editor에서 `supabase/schema.sql` 내용을 실행하세요.

### 핵심 프로필 테이블

- `user_email` (PK, 고유 키)
- `pet_name`
- `personality_type`
- `generated_letter`
- `preferred_scenery`

### 답변 로그 테이블

모든 질문 답변을 유지하기 위해 `soul_trace_answers` 테이블도 함께 사용합니다.

## 3) 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 4) 저장/조회 API

### 편지 생성 + 저장

- `POST /api/generate-letter`
- 입력: `userEmail`, `petName`, `preferredScenery`, `privacyConsent`, `answers`
- 동작:
  - OpenAI로 성향/편지 생성
  - `soul_trace_profiles`를 `user_email` 기준 upsert
  - `soul_trace_answers`에 5개 답변 저장

### 기계 연동용 데이터 조회

- `GET /api/customer-data?email=...`
- 동작:
  - 이메일 기준 프로필 + 5문항 답변 반환
  - 이터널빔 기기 설정 플로우에서 해당 API를 호출하면 자동 매칭 가능

## 5) Vercel 배포 & 커스텀 도메인 `soultrace.eternalbeam.com`

### 5-1) Vercel

1. [Vercel](https://vercel.com)에 이 저장소(또는 `soul-trace` 폴더) 연결
2. **Settings → Environment Variables**에 아래 등록 (Production에 동일하게)
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://soultrace.eternalbeam.com`
3. 재배포

### 5-2) 도메인 연결 (DNS)

** eternalbeam.com DNS를 관리하는 곳**에서:

| 유형 | 이름(Host) | 값(Target) |
|------|-------------|------------|
| `CNAME` | `soultrace` | Vercel이 안내하는 주소 (예: `cname.vercel-dns.com` 또는 프로젝트별로 표시되는 값) |

1. Vercel → 해당 프로젝트 → **Settings → Domains**
2. `soultrace.eternalbeam.com` 추가
3. 표시되는 **정확한 CNAME 대상**을 복사해 DNS에 붙여넣기 (위 표의 “값”은 프로젝트마다 다를 수 있음)
4. SSL 발급까지 몇 분~최대 48시간까지 걸릴 수 있음

> 도메인을 “등록”만 하고 Vercel에 추가하지 않았다면, 반드시 Vercel **Domains**에 서브도메인을 먼저 추가한 뒤 DNS를 맞추면 연결됩니다.
