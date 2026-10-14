import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync("components/polaroid-entry.tsx", "utf8");
const gate = readFileSync("components/letter-download-gate.tsx", "utf8");
const route = readFileSync("app/api/account-result/seasonal-polaroid/route.ts", "utf8");
const migration = readFileSync("supabase/migration_seasonal_polaroid_results.sql", "utf8");

test("Seasonal Save and Download reuse the authenticated OTP gate", () => {
  assert.match(component, /LetterDownloadGate/);
  assert.match(component, /purpose="seasonal-polaroid"/);
  assert.match(component, /writePendingResultSave/);
  assert.match(component, /api\/account-result\/seasonal-polaroid/);
  assert.match(gate, /"seasonal-polaroid"/);
  assert.match(gate, /bodySeasonalPolaroid/);
});

test("Seasonal result offers Regenerate while Download remains wired", () => {
  assert.match(component, /onRegenerate=\{regenerate\}/);
  assert.match(component, /LuRefreshCw/);
  assert.match(component, /seasonalPolaroid\.generation\.regenerate/);
  assert.match(component, /void runGeneration\(true\)/);
  assert.match(component, /generationNonce: allowFromResult[\s\S]*globalThis\.crypto\?\.randomUUID\?\.\(\)/);
  assert.doesNotMatch(component, /disabled aria-disabled="true" onClick=\{onSave\}/);
  assert.doesNotMatch(component, /saveComingSoon|Coming soon/);
  assert.doesNotMatch(component, /flex flex-col items-center gap-1\.5/);
  assert.match(component, /onClick=\{onDownload\}/);
  assert.match(component, /seasonalPolaroid\.generation\.download/);
});

test("Seasonal export renders the approved 1080 by 1620 template canvas", () => {
  assert.match(component, /toCanvas/);
  assert.doesNotMatch(component, /cacheBust: true/);
  assert.match(component, /cacheBust: false/);
  assert.match(component, /output\.width = 1080/);
  assert.match(component, /output\.height = 1620/);
  assert.match(component, /output\.toBlob\(resolve, "image\/png"/);
});

test("Seasonal preview uses the stable decorative frame and bounded caption window", () => {
  assert.match(component, /soul_trace_seasonal_polaroid_blank_caption_template\.png/);
  assert.match(component, /aspect-\[2\/3\]/);
  assert.match(component, /bottom-\[17\.5%\] left-\[22%\] right-\[22%\] top-\[71\.5%\]/);
  assert.match(component, /overflow-hidden/);
  assert.match(component, /memoLines\.slice\(0, 4\)/);
  assert.match(component, /SOUL TRACE/);
});

test("Seasonal result preview clips the square generated image inside the approved photo window", () => {
  assert.match(component, /imageUrl && !placeholder[^\n]*className="h-full w-full object-cover object-center"/);
});

test("Seasonal save verifies the job capability and keeps result objects private", () => {
  assert.match(route, /seasonalPolaroidCapabilityMatches/);
  assert.match(route, /job\.generation_kind !== "seasonal_polaroid"/);
  assert.match(route, /isSeasonalPolaroidResultPath\(jobId, imageRecord\.objectKey\)/);
  assert.match(route, /authentication_required/);
  assert.match(route, /already_saved/);
  assert.doesNotMatch(route, /getPublicUrl/);
});

test("Seasonal save migration is additive and owner-protected", () => {
  assert.match(migration, /create table if not exists public\.seasonal_polaroid_results/);
  assert.match(migration, /owner_user_id uuid not null/);
  assert.match(migration, /image_object_key text not null/);
  assert.match(migration, /alter table public\.seasonal_polaroid_results enable row level security/);
  assert.match(migration, /Owners can read their seasonal polaroids/);
  assert.match(migration, /memo_line_4/);
  assert.doesNotMatch(migration, /job_id text not null unique/);
  assert.match(migration, /seasonal_polaroid_results_job_idx/);
  assert.match(migration, /constraint seasonal_polaroid_results_status_check check \(status in \('living', 'passed'\)\)/);
  assert.match(migration, /constraint seasonal_polaroid_results_job_id_format check \(job_id ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(migration, /create policy[\s\S]*Owners can read their seasonal polaroids/);
  assert.match(migration, /pg_policies/);
});
