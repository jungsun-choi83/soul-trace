/**
 * Supabase 저장과 별도로 Google 스프레드시트에 한 줄 append.
 *
 * 설정: Vercel(또는 로컬) 환경 변수
 *   GOOGLE_SHEETS_WEB_APP_URL — Apps Script「배포」웹 앱의 URL (POST 허용)
 *   GOOGLE_SHEETS_INGEST_SECRET — (선택) 본문 JSON의 secret과 동일해야만 append 하도록 스크립트에서 검증
 *
 * --- Google Apps Script 예시 (시트에 연결된 프로젝트에 붙여넣기 후 배포 > 웹 앱) ---
 * function doPost(e) {
 *   const props = PropertiesService.getScriptProperties();
 *   const expected = props.getProperty('INGEST_SECRET'); // 스크립트 속성에 INGEST_SECRET 저장 (Vercel과 동일 문자열)
 *   let body;
 *   try { body = JSON.parse(e.postData.contents); } catch (err) { return textOut('bad json', 400); }
 *   if (expected && body.secret !== expected) return textOut('forbidden', 403);
 *   const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
 *   sh.appendRow([
 *     body.timestamp || new Date().toISOString(),
 *     body.locale || '',
 *     body.userEmail || '',
 *     body.petName || '',
 *     body.preferredScenery || '',
 *     body.personalityType || '',
 *     body.personalitySummary || '',
 *     body.personalityTags || '',
 *     body.heroImageUrl || '',
 *     body.letterPreview || '',
 *     body.answersJson || '',
 *   ]);
 *   return textOut('ok', 200);
 * }
 * function textOut(msg, code) {
 *   const out = ContentService.createTextOutput(msg);
 *   // 웹 앱은 기본 200; 실패 시에도 로그용으로 msg만 다르게 할 수 있음
 *   return out;
 * }
 */

export type SoulTraceSheetRow = {
  locale: string;
  userEmail: string;
  petName: string;
  preferredScenery: string;
  personalityType: string;
  personalitySummary: string;
  personalityTags: string;
  heroImageUrl: string | null;
  /** 시트 셀 한도 고려해 서버에서 잘라 보냄 */
  letterPreview: string;
  answersJson: string;
};

const FETCH_MS = 12_000;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export async function appendSoulTraceToGoogleSheets(row: SoulTraceSheetRow): Promise<void> {
  const url = process.env.GOOGLE_SHEETS_WEB_APP_URL?.trim();
  if (!url) return;

  const secret = process.env.GOOGLE_SHEETS_INGEST_SECRET?.trim();
  const timestamp = new Date().toISOString();

  const body = {
    secret: secret && secret.length > 0 ? secret : undefined,
    timestamp,
    locale: row.locale,
    userEmail: row.userEmail,
    petName: row.petName,
    preferredScenery: row.preferredScenery,
    personalityType: row.personalityType,
    personalitySummary: truncate(row.personalitySummary, 1800),
    personalityTags: truncate(row.personalityTags, 500),
    heroImageUrl: row.heroImageUrl ?? "",
    letterPreview: truncate(row.letterPreview, 4500),
    answersJson: truncate(row.answersJson, 4500),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[google-sheets-ingest]", res.status, t.slice(0, 500));
    }
  } catch (e) {
    console.error("[google-sheets-ingest]", e instanceof Error ? e.message : e);
  } finally {
    clearTimeout(timer);
  }
}
