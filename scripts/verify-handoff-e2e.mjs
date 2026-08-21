#!/usr/bin/env node
/**
 * Phase 10.5 핸드오프 전 구간 점검 — **마이그레이션 적용 후** 실행한다.
 *
 *   node scripts/verify-handoff-e2e.mjs
 *   node scripts/verify-handoff-e2e.mjs --base https://soultrace.eternalbeam.com
 *
 * 필요한 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
 *     → npx vercel env pull .env.verify --environment=production
 *   SOUL_TRACE_SERVICE_TOKEN
 *     → ⚠️ Vercel 에 **sensitive** 로 저장돼 있어 pull 로 다시 읽을 수 없다(빈 값이 온다).
 *        그것이 의도다 — 비밀은 쓰기 전용이다. 값은 아래에서 가져온다:
 *          eternal-beam-app/.env.local  (gitignore 됨, Render 에 넣는 것과 같은 값)
 *        또는 직접 지정:
 *          SOUL_TRACE_SERVICE_TOKEN=... node scripts/verify-handoff-e2e.mjs
 *
 * 무엇을 확인하는가:
 *   A  letter_id 가 존재하고 UUID 다
 *   B  POST /api/handoff 가 traceId + 불투명 토큰만 돌려준다
 *   G  URL 어디에도 편지·설문·이메일이 실리지 않는다
 *   D  POST /api/internal/letter 가 서비스 토큰으로 정본을 돌려준다
 *   E  같은 토큰의 두 번째 교환이 409 로 거절된다
 *   —  설문 답변이 응답에 들어 있지 않다
 *   —  서비스 토큰 없이는 401 이다
 *   —  브라우저(Origin 헤더)로는 내부 라우트를 쓸 수 없다
 *
 * ⚠️ 이 스크립트는 **읽기 위주**다. 만드는 것은 핸드오프 토큰 몇 개뿐이고,
 *    편지·프로필·답변을 생성하거나 수정하지 않는다.
 */

import { readFileSync, existsSync } from "node:fs";

const argBase = process.argv.indexOf("--base");
const BASE = (argBase > -1 ? process.argv[argBase + 1] : "http://localhost:3000").replace(/\/+$/, "");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const out = {};
  for (const [, k, v] of raw.matchAll(/^([A-Z_][A-Z0-9_]*)="([\s\S]*?)"\s*$/gm)) {
    out[k] = v.replace(/\\r/g, "\r").replace(/\\n/g, "\n").trim();
  }
  for (const [, k, v] of raw.matchAll(/^([A-Z_][A-Z0-9_]*)=([^"\n]*)$/gm)) {
    if (!(k in out)) out[k] = v.trim();
  }
  return out;
}

// 빈 값은 무시한다 — sensitive 로 저장된 값은 vercel pull 이 빈 문자열로 주므로,
// 그것이 진짜 값을 덮어써서는 안 된다.
const fileEnv = {};
for (const p of [".env.verify", ".env.local"]) {
  for (const [k, v] of Object.entries(loadEnvFile(p))) if (v) fileEnv[k] = v;
}

// Eternal Beam 쪽 파일에서는 **공유 서비스 토큰 하나만** 가져온다.
//
// ⚠️ 파일 전체를 합치면 안 된다: 그쪽 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는
//    **다른 프로젝트(kdlukiujgclczwqmwvmk)의 자격 증명**이라, 합치는 순간 이
//    스크립트가 Soul Trace DB 에 Eternal Beam 키를 들이민다. 두 프로젝트의
//    자격 증명을 섞지 않는 것이 이 통합 전체의 전제다.
const SHARED_ONLY = "SOUL_TRACE_SERVICE_TOKEN";
if (!fileEnv[SHARED_ONLY]) {
  const eb = loadEnvFile("../eternal-beam-app/.env.local")[SHARED_ONLY];
  if (eb) fileEnv[SHARED_ONLY] = eb;
}

const env = (k) => (process.env[k] || fileEnv[k] || "").trim();

const SUPA = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const SVC = env("SOUL_TRACE_SERVICE_TOKEN");

let pass = 0;
let fail = 0;
const ok = (label, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
};

async function sb(path, init = {}) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  console.log(`\nSoul Trace 핸드오프 점검 — ${BASE}\n`);

  for (const [name, v] of [["NEXT_PUBLIC_SUPABASE_URL", SUPA], ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY], ["SOUL_TRACE_SERVICE_TOKEN", SVC]]) {
    if (!v) { console.error(`환경변수 ${name} 가 없습니다. vercel env pull 로 받아 오세요.`); process.exit(2); }
  }

  // ── 스키마 ────────────────────────────────────────────────────────────────
  console.log("스키마");
  const cols = await sb("soul_trace_profiles?select=letter_id,created_at&limit=1");
  ok("letter_id / created_at 컬럼이 있다", cols.status === 200, JSON.stringify(cols.body).slice(0, 160));
  const handoffTable = await sb("soul_trace_handoffs?select=token_hash&limit=1");
  ok("soul_trace_handoffs 표가 있다", handoffTable.status === 200, JSON.stringify(handoffTable.body).slice(0, 160));
  if (cols.status !== 200 || handoffTable.status !== 200) {
    console.log("\n마이그레이션(APPLY_PHASE_10_5.sql)이 아직 적용되지 않았습니다.\n");
    process.exit(1);
  }

  // ── A. 실제 편지의 letter_id ──────────────────────────────────────────────
  console.log("\nA. 실제 편지");
  const rows = await sb("soul_trace_profiles?select=letter_id,generated_letter,pet_name&limit=1&order=created_at.desc");
  const letter = Array.isArray(rows.body) ? rows.body[0] : null;
  ok("편지가 최소 한 통 있다", Boolean(letter));
  if (!letter) { console.log("\n먼저 Soul Trace 에서 편지를 하나 생성하세요.\n"); process.exit(1); }
  ok("letter_id 가 UUID 다", UUID_RE.test(letter.letter_id), letter.letter_id);
  ok("본문이 비어 있지 않다", String(letter.generated_letter ?? "").trim().length > 0);

  // ── B/G. 핸드오프 발급 ────────────────────────────────────────────────────
  console.log("\nB · G. 핸드오프 발급 (POST /api/handoff)");
  const mint = await fetch(`${BASE}/api/handoff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ letterId: letter.letter_id }),
  });
  const minted = await mint.json().catch(() => ({}));
  ok("200 을 돌려준다", mint.status === 200, `http=${mint.status} ${JSON.stringify(minted).slice(0, 160)}`);
  ok("traceId 가 편지 id 와 같다", minted.traceId === letter.letter_id);
  ok("토큰이 base64url 43자(256비트)다", /^[A-Za-z0-9_-]{43}$/.test(minted.handoff ?? ""));

  const keys = Object.keys(minted ?? {}).sort();
  ok("응답에 traceId·handoff 외에는 없다", JSON.stringify(keys) === JSON.stringify(["handoff", "traceId"]), keys.join(","));

  const url = `https://device.eternalbeam.com/soul-trace/import?traceId=${minted.traceId}&handoff=${minted.handoff}`;
  const bodyStart = String(letter.generated_letter).trim().slice(0, 12);
  ok("URL 에 편지 본문이 없다", !url.includes(bodyStart));
  ok("URL 에 이메일이 없다", !/@/.test(url));
  ok("URL 에 펫 이름이 없다", !letter.pet_name || !url.includes(letter.pet_name));

  // 원문 토큰이 DB 에 저장되지 않았는지 (해시만 있어야 한다)
  const stored = await sb(`soul_trace_handoffs?select=token_hash,consumed_at&letter_id=eq.${letter.letter_id}`);
  const rawStored = JSON.stringify(stored.body ?? "");
  ok("원문 토큰이 DB 에 저장되지 않았다", !rawStored.includes(minted.handoff));

  // ── 인증 ──────────────────────────────────────────────────────────────────
  console.log("\n내부 라우트 인증");
  const noAuth = await fetch(`${BASE}/api/internal/letter`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ traceId: minted.traceId, handoff: minted.handoff }),
  });
  ok("서비스 토큰 없이는 401", noAuth.status === 401, `http=${noAuth.status}`);

  const wrongAuth = await fetch(`${BASE}/api/internal/letter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-EB-Service-Token": "w".repeat(43) },
    body: JSON.stringify({ traceId: minted.traceId, handoff: minted.handoff }),
  });
  ok("틀린 토큰도 401", wrongAuth.status === 401, `http=${wrongAuth.status}`);

  // ── D. 정본 교환 ──────────────────────────────────────────────────────────
  console.log("\nD. 서버 대 서버 교환 (POST /api/internal/letter)");
  const redeem = await fetch(`${BASE}/api/internal/letter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-EB-Service-Token": SVC },
    body: JSON.stringify({ traceId: minted.traceId, handoff: minted.handoff, consumedBy: "verify@script" }),
  });
  const got = await redeem.json().catch(() => ({}));
  ok("200 을 돌려준다", redeem.status === 200, `http=${redeem.status} ${JSON.stringify(got).slice(0, 160)}`);
  ok("본문이 Soul Trace 정본과 **정확히** 같다", got.letterBody === letter.generated_letter);
  ok("letterId 가 일치한다", got.letterId === letter.letter_id);
  const gotKeys = Object.keys(got ?? {}).sort();
  ok("응답에 letterId·letterBody·petName 만 있다",
     JSON.stringify(gotKeys) === JSON.stringify(["letterBody", "letterId", "petName"]), gotKeys.join(","));
  ok("설문 답변이 들어 있지 않다", !("answers" in (got ?? {})) && !JSON.stringify(got).includes("answer"));
  ok("이메일이 들어 있지 않다", !/@/.test(JSON.stringify(got)));

  // ── E. 1회용 ──────────────────────────────────────────────────────────────
  console.log("\nE. 1회용 · 재사용 거절");
  const again = await fetch(`${BASE}/api/internal/letter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-EB-Service-Token": SVC },
    body: JSON.stringify({ traceId: minted.traceId, handoff: minted.handoff, consumedBy: "verify@script" }),
  });
  ok("두 번째 교환은 409", again.status === 409, `http=${again.status}`);
  const audit = await sb(`soul_trace_handoffs?select=consumed_at,consumed_by&letter_id=eq.${letter.letter_id}&consumed_by=eq.verify@script`);
  ok("소비 감사 기록이 남았다", Array.isArray(audit.body) && audit.body.length > 0 && audit.body[0].consumed_at);

  // ── 정리 ──────────────────────────────────────────────────────────────────
  await sb(`soul_trace_handoffs?consumed_by=eq.verify@script`, { method: "DELETE" });

  console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("점검 중 오류:", e); process.exit(2); });
