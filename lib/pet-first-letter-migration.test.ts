import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/drafts/20261106_002_pet_first_letter_persistence.sql", import.meta.url),
  "utf8",
);
const preflight = readFileSync(
  new URL("../supabase/drafts/20261106_002_pet_first_letter_preflight.sql", import.meta.url),
  "utf8",
);
const functionBody = migration.split("as $function$")[1]?.split("$function$")[0] ?? "";

test("new Pet-First letters reuse only the exact selected pet owned by the confirmed account", () => {
  assert.match(functionBody, /if new\.pet_id is not null then[\s\S]*?selected_pet_requires_confirmed_account/);
  assert.match(functionBody, /where p\.pet_id = new\.pet_id[\s\S]*?for update/);
  assert.match(functionBody, /pet_owner_user_id is distinct from account_user_id[\s\S]*?selected_pet_does_not_belong_to_confirmed_account/);
  assert.match(functionBody, /linked_pet_id := new\.pet_id/);
  assert.match(functionBody, /selected_pet_does_not_exist/);
});

test("invalid and foreign pet IDs fail without falling back to another pet", () => {
  const selectedPetBranch = functionBody.split("if new.pet_id is not null then")[1]?.split("else")[0] ?? "";
  assert.match(selectedPetBranch, /raise exception 'selected_pet_does_not_exist'/);
  assert.match(selectedPetBranch, /raise exception 'selected_pet_does_not_belong_to_confirmed_account'/);
  assert.doesNotMatch(selectedPetBranch, /insert into public\.soul_trace_pets/i);
});

test("legacy generation without a selected Pet ID retains its historical pet creation path", () => {
  assert.match(functionBody, /if new\.pet_id is not null then[\s\S]*?else[\s\S]*?insert into public\.soul_trace_pets \(owner_user_id, pet_name, created_at\)/);
});

test("multiple letters can reuse one pet without creating another pet row", () => {
  assert.equal((functionBody.match(/insert into public\.soul_trace_pets/gi) ?? []).length, 1);
  assert.match(functionBody, /linked_pet_id := new\.pet_id/);
  assert.doesNotMatch(migration, /unique\s*\(\s*pet_id\s*\)/i);
});

test("a letter rerun or language update retains its original pet and rejects reassociation", () => {
  assert.match(functionBody, /if linked_submission_id is not null then/);
  assert.match(functionBody, /account_user_id is null[\s\S]*?confirmed_letter_owner_required/);
  assert.match(functionBody, /lower\(linked_user_email\) is distinct from lower\(new\.user_email\)[\s\S]*?existing_letter_email_owner_mismatch/);
  assert.match(functionBody, /new\.pet_id is not null and new\.pet_id is distinct from linked_pet_id[\s\S]*?existing_letter_pet_reassociation_rejected/);
  assert.match(functionBody, /old\.pet_id is not null[\s\S]*?old\.pet_id is distinct from linked_pet_id[\s\S]*?stored_letter_pet_link_is_inconsistent/);
  assert.match(functionBody, /update public\.soul_trace_submissions[\s\S]*?where s\.submission_id = linked_submission_id/);
});

test("existing non-null Pet IDs cannot be cleared, while historical NULL Pet IDs remain valid", () => {
  assert.match(functionBody, /old\.pet_id is not null and new\.pet_id is null[\s\S]*?letter_pet_id_cannot_be_cleared/);
  assert.doesNotMatch(functionBody, /old\.pet_id is null[\s\S]{0,100}raise exception 'letter_pet_id_cannot_be_cleared'/);
});

test("new submission and legacy link use the same selected pet and letter identifiers", () => {
  assert.match(functionBody, /insert into public\.soul_trace_submissions[\s\S]*?linked_pet_id, account_user_id, new\.letter_id/);
  assert.match(functionBody, /insert into public\.soul_trace_legacy_links[\s\S]*?new\.user_email, linked_pet_id, linked_submission_id, new\.letter_id/);
  assert.match(migration, /unique[\s\S]{0,120}letter_id/i);
});

test("canonical pet name and profile are not overwritten by letter questionnaire values", () => {
  assert.doesNotMatch(functionBody, /set\s+pet_name\s*=\s*new\.pet_name/i);
  assert.match(functionBody, /-- Keep the existing pet_id and canonical pet_name/);
});

test("trusted server boundary uses SECURITY DEFINER with a fixed search path", () => {
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(functionBody, /caller_role not in \('service_role', 'postgres'\)/);
  assert.match(migration, /alter function public\.sync_soul_trace_legacy_profile\(\) owner to postgres/i);
  assert.match(migration, /revoke all on function public\.sync_soul_trace_legacy_profile\(\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.sync_soul_trace_legacy_profile\(\) to service_role/i);
});

test("only server-side profile persistence retains write privileges", () => {
  assert.match(migration, /revoke insert, update, delete, truncate on table public\.soul_trace_profiles\s+from public, anon, authenticated/i);
  assert.match(migration, /grant select, insert, update on table public\.soul_trace_profiles\s+to service_role/i);
  assert.doesNotMatch(migration, /grant select, insert, update, delete on table public\.soul_trace_profiles/i);
});

test("trigger fires when pet_id is inserted or changed", () => {
  assert.match(migration, /after insert or update of\s+pet_name, pet_id[\s\S]*?on public\.soul_trace_profiles/i);
  assert.match(migration, /letter_id, user_email\s+on public\.soul_trace_profiles/i);
});

test("read-only preflight surfaces legacy accounts affected by confirmed-email checks without exposing emails", () => {
  assert.match(preflight, /profiles_matching_unconfirmed_auth_accounts/);
  assert.match(preflight, /profiles_without_matching_auth_account/);
  assert.doesNotMatch(preflight, /select\s+[^;]*u\.email\s*(?:,|from)/i);
});
