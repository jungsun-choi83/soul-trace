import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  claimFreeTrialSession,
  fetchAuthorizedFreeTrialResult,
  listOwnedFreeTrialResults,
} from "./free-trial-account.ts";
import { FREE_TRIAL_SAVE_AUTH_PATH, freeTrialSaveDestination } from "./free-trial-onboarding.ts";

const OWNER_A = "00000000-0000-4000-8000-000000000001";
const OWNER_B = "00000000-0000-4000-8000-000000000002";
const PET = "00000000-0000-4000-8000-000000000003";
const RESULT = "00000000-0000-4000-8000-000000000004";
const GUEST_HASH = "a".repeat(64);
const authEntry = readFileSync("components/auth-entry.tsx", "utf8");
const authConfirm = readFileSync("app/auth/confirm/route.ts", "utf8");
const savePage = readFileSync("app/try/save/page.tsx", "utf8");
const accountPage = readFileSync("app/my/free-trial-results/page.tsx", "utf8");
const persistenceServer = readFileSync("lib/free-trial-persistence-server.ts", "utf8");
const trialFlow = readFileSync("components/free-trial-flow.tsx", "utf8");

test("signup, OTP, and login return through the trial bridge to the dashboard without claiming a pet", async () => {
  const { newAccountProfilePath, authCallbackUrl, safeAuthConfirmationPath, continueAfterAuth } = await import("./auth-redirect.ts");
  const newAccountReturn = newAccountProfilePath("/try/save");
  assert.equal(newAccountReturn, "/try/save");
  const callback = new URL(authCallbackUrl("https://soultrace.example", newAccountReturn, "en"));
  assert.equal(callback.searchParams.get("next"), "/try/save");
  assert.equal(safeAuthConfirmationPath("/try/save", "/choose"), "/try/save");
  assert.equal(continueAfterAuth("/try/save"), "/try/save");
  assert.equal(newAccountProfilePath("/living?ch=pension"), "/my/pets/new?status=living&continueTo=%2Fliving%3Fch%3Dpension");
  assert.match(authEntry, /confirmationRedirectTo\(newProfilePath\)/);
  assert.match(authEntry, /beginEmailConfirmation\(newProfilePath\)/);
  assert.match(authConfirm, /safeAuthConfirmationPath/);
  assert.match(trialFlow, /<Link href="\/try\/save"/);
  assert.doesNotMatch(trialFlow, /sessionStorage|PENDING_TRIAL_KEY/);
  assert.match(savePage, /createSupabaseAuthServerClient\(\)/);
  assert.match(savePage, /freeTrialSaveDestination\(Boolean\(auth && user\)\)/);
  assert.doesNotMatch(savePage, /claimDurableFreeTrial|trialLedger|ensureOwnerRow/);
  assert.equal(FREE_TRIAL_SAVE_AUTH_PATH, "/auth?mode=signup&returnTo=%2Ftry%2Fsave");

  const mockedAuth = (user: { id: string } | null) => ({ auth: { async getUser() { return { data: { user } }; } } });
  const newUserAuth = mockedAuth({ id: OWNER_A });
  const existingUserAuth = mockedAuth({ id: OWNER_B });
  const guestAuth = mockedAuth(null);
  assert.equal(freeTrialSaveDestination(Boolean((await newUserAuth.auth.getUser()).data.user)), "/dashboard");
  assert.equal(freeTrialSaveDestination(Boolean((await existingUserAuth.auth.getUser()).data.user)), "/dashboard");
  assert.equal(freeTrialSaveDestination(Boolean((await guestAuth.auth.getUser()).data.user)), FREE_TRIAL_SAVE_AUTH_PATH);
  assert.doesNotMatch(trialFlow, /petId|create.*[Pp]et/i);
});

test("guest claims are idempotent for their owner and reject other accounts", async () => {
  const claims = new Map<string, string>();
  const claim = async (guest: string, owner: string) => {
    const existing = claims.get(guest);
    if (existing) return existing === owner;
    claims.set(guest, owner);
    return true;
  };
  assert.equal(await claimFreeTrialSession(GUEST_HASH, OWNER_A, claim), true);
  assert.equal(await claimFreeTrialSession(GUEST_HASH, OWNER_A, claim), true);
  assert.equal(await claimFreeTrialSession(GUEST_HASH, OWNER_B, claim), false);
  assert.equal(await claimFreeTrialSession("invalid", OWNER_A, claim), false);
  assert.equal(claims.size, 1);
});

test("account result listing filters rows to the authenticated owner and validates metadata", async () => {
  let requestedOwner = "";
  const rows = [
    { result_id: RESULT, pet_id: PET, owner_user_id: OWNER_A, style: "felt-doll", theme: "christmas-village", created_at: "2026-11-09T00:00:00Z" },
    { result_id: "00000000-0000-4000-8000-000000000005", pet_id: PET, owner_user_id: OWNER_B, style: "felt-doll", theme: "christmas-village", created_at: "2026-11-09T00:00:00Z" },
    { result_id: RESULT, pet_id: PET, owner_user_id: OWNER_A, style: "unknown", theme: "theme", created_at: "2026-11-09T00:00:00Z" },
  ];
  const output = await listOwnedFreeTrialResults(OWNER_A, async (ownerId) => {
    requestedOwner = ownerId;
    return { rows, error: false };
  });
  assert.equal(requestedOwner, OWNER_A);
  assert.match(persistenceServer, /\.eq\("owner_user_id", verifiedOwnerId\)/);
  assert.match(accountPage, /auth\.auth\.getUser\(\)/);
  assert.equal(output.status, "ok");
  if (output.status === "ok") assert.deepEqual(output.results.map((item) => item.resultId), [RESULT]);
  const unavailable = await listOwnedFreeTrialResults(OWNER_A, async () => ({ rows: null, error: true }));
  assert.deepEqual(unavailable, { status: "unavailable" });
});

test("trial continuation never claims or presents a result as permanently saved", () => {
  assert.match(savePage, /freeTrialSaveDestination\(Boolean\(auth && user\)\)/);
  assert.doesNotMatch(savePage, /claimDurableFreeTrial|freeTrialPersistenceEnabled|trialLedger/);
  assert.equal(freeTrialSaveDestination(true), "/dashboard");
  assert.equal(freeTrialSaveDestination(false), FREE_TRIAL_SAVE_AUTH_PATH);
  assert.match(accountPage, /Permanent Free Trial saving is not enabled/);
  assert.match(accountPage, /No result is being reported as saved right now/);
});

test("saved image retrieval requires authorization and uses the canonical private object key", async () => {
  const blob = new Blob(["image"]);
  let downloaded = "";
  const common = {
    resultId: RESULT,
    guestHash: GUEST_HASH,
    ownerId: null,
  };
  const denied = await fetchAuthorizedFreeTrialResult(
    common,
    async () => null,
    async (key) => { downloaded = key; return blob; },
  );
  assert.equal(denied, null);
  assert.equal(downloaded, "");
  const allowed = await fetchAuthorizedFreeTrialResult(
    common,
    async () => "free-trial/" + RESULT + ".jpg",
    async (key) => { downloaded = key; return blob; },
  );
  assert.equal(allowed, blob);
  assert.equal(downloaded, "free-trial/" + RESULT + ".jpg");
  assert.equal(await fetchAuthorizedFreeTrialResult(
    { ...common, resultId: "invalid" },
    async () => "free-trial/" + RESULT + ".jpg",
    async () => blob,
  ), null);
});
