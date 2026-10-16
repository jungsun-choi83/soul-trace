import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/letter-share/route.ts", "utf8");
const loader = readFileSync("lib/letter-share.ts", "utf8");
const migration = readFileSync("supabase/migration_letter_shares.sql", "utf8");
const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");

test("letter shares use opaque hashed tokens and authenticated ownership checks", () => {
  assert.match(loader, /randomBytes\(32\)/);
  assert.match(loader, /createHash\("sha256"\)/);
  assert.match(route, /resultSaveProofMatches\("letter"/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /submission\.owner_user_id && submission\.owner_user_id !== user\?\.id/);
  assert.match(route, /token_hash/);
});

test("shared letters are read-only, expiring, and never grant client table access", () => {
  assert.match(migration, /expires_at timestamptz not null/);
  assert.match(migration, /alter table public\.letter_shares enable row level security/i);
  assert.match(migration, /revoke all on table public\.letter_shares from public, anon, authenticated/i);
  assert.match(loader, /share\.revoked_at/);
  assert.match(loader, /share\.expires_at/);
});

test("all result share actions request the durable share URL", () => {
  assert.match(flow, /ensureLetterShareUrl/);
  assert.match(flow, /mobileWebUrl: url/);
  assert.match(flow, /navigator\.share\(\{ title: t\("share\.title"\), text: t\("share\.text"\), url \}\)/);
  assert.match(flow, /navigator\.clipboard\.writeText\(await ensureLetterShareUrl\(\)\)/);
  assert.match(flow, /action: openNativeShare/);
});
