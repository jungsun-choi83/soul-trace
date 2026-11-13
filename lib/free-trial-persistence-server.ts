import "server-only";

import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import OpenAI from "openai";
import { generateTrialPolaroidImage, type TrialThemeId } from "@/lib/trial-polaroid-ai";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { FreeStyle } from "@/lib/pet-free-trial";
import { freeTrialResultObjectKey } from "@/lib/free-trial-persistence-contract";
import { requestIp } from "@/lib/ai-generation-guard";
import {
  claimFreeTrialSession,
  fetchAuthorizedFreeTrialResult,
  listOwnedFreeTrialResults,
} from "@/lib/free-trial-account";

export const FREE_TRIAL_GUEST_COOKIE = "soul_trace_trial";
const BUCKET = "free-trial-results";

type Actor = { userId: string | null; guestHash: string | null };
type Plate = { bytes: ArrayBuffer; name: string; type: string };

function secret() {
  return process.env.AI_GENERATION_GUARD_SECRET?.trim() || process.env.SOUL_TRACE_SERVICE_TOKEN?.trim() || null;
}
export function freeTrialPersistenceEnabled(): boolean {
  return process.env.SOUL_TRACE_FREE_TRIAL_PERSISTENCE_ENABLED === "true"
    && process.env.SOUL_TRACE_FREE_TRIAL_SCHEMA_READY === "true";
}
function digest(value: string) {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(value).digest("hex");
}
function sign(id: string) {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update("free-trial-cookie:" + id).digest("base64url");
}
function cookieValue(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return header.match(new RegExp("(?:^|;\\s*)" + FREE_TRIAL_GUEST_COOKIE + "=([^;]+)"))?.[1] ?? null;
}
export function freeTrialGuestHashFromCookie(value: string | undefined): string | null {
  if (!value || !secret()) return null;
  const [id, sig, extra] = value.split(".");
  if (extra || !id || !sig || !/^[A-Za-z0-9_-]{40,64}$/.test(id)) return null;
  const expected = sign(id);
  if (!expected || expected.length !== sig.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  return digest("free-trial-guest:" + id);
}
function guestCookie(request: Request): { hash: string; setCookie: string | null } | null {
  if (!secret()) return null;
  const current = cookieValue(request);
  const validHash = current ? freeTrialGuestHashFromCookie(current) : null;
  if (current && validHash) return { hash: validHash, setCookie: null };
  const id = randomBytes(32).toString("base64url");
  const signature = sign(id);
  const hash = digest("free-trial-guest:" + id);
  if (!signature || !hash) return null;
  const secure = process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:";
  return { hash, setCookie: FREE_TRIAL_GUEST_COOKIE + "=" + id + "." + signature + "; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : "") };
}
function applyCookie(response: Response, cookie: string | null): Response {
  if (!cookie) return response;
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function json(payload: unknown, status: number, cookie: string | null) {
  return applyCookie(Response.json(payload, { status, headers: { "Cache-Control": "private, no-store" } }), cookie);
}
function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function rpcRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function hashBytes(bytes: ArrayBuffer) {
  return createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
}
function hashIp(request: Request) {
  return digest("ip:" + requestIp(request));
}
function resultKey(id: string) {
  const key = freeTrialResultObjectKey(id);
  if (!key) throw new Error("invalid free trial result id");
  return key;
}
async function fail(supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>, resultId: string) {
  const { error } = await supabase.rpc("fail_free_trial_generation", { p_result_id: resultId });
  if (error) console.error("[free-trial-persistence] failure release failed", { code: error.code });
}

export async function handleDurableFreeTrial(args: {
  request: Request;
  name: string;
  style: FreeStyle;
  theme: TrialThemeId;
  idempotencyKey: string;
  photo: File;
  plate: Plate;
}): Promise<Response> {
  const identity = guestCookie(args.request);
  if (!identity) return json({ error: "persistence_unavailable" }, 503, null);
  const supabase = createSupabaseServerClient();
  const setCookie = identity.setCookie;
  if (!supabase) return json({ error: "persistence_unavailable" }, 503, setCookie);
  const actor: Actor = { userId: null, guestHash: identity.hash };
  if (!process.env.OPENAI_API_KEY?.trim()) return json({ error: "generation_unavailable" }, 503, setCookie);
  const name = args.name.trim().replace(/\s+/g, " ");
  const { data: petData, error: petError } = await supabase.rpc("register_free_trial_pet", {
    p_guest_hash: actor.guestHash, p_owner_id: actor.userId, p_name: name,
  });
  const petId = rpcRecord(petData).pet_id;
  if (petError || !uuid(petId)) {
    console.error("[free-trial-persistence] pet registration failed", { code: petError?.code });
    return json({ error: "persistence_unavailable" }, 503, setCookie);
  }
  const photoBytes = await args.photo.arrayBuffer();
  const requestHash = createHash("sha256")
    .update(args.style + "\n" + args.theme + "\n" + name + "\n" + hashBytes(photoBytes))
    .digest("hex");
  const ipHash = hashIp(args.request);
  if (!ipHash) return json({ error: "persistence_unavailable" }, 503, setCookie);
  const { data: reserveData, error: reserveError } = await supabase.rpc("reserve_free_trial_generation", {
    p_pet_id: petId, p_guest_hash: actor.guestHash, p_owner_id: actor.userId, p_ip_hash: ipHash,
    p_key: args.idempotencyKey, p_hash: requestHash, p_style: args.style, p_theme: args.theme,
  });
  const reservation = rpcRecord(reserveData);
  if (reserveError) {
    console.error("[free-trial-persistence] reservation failed", { code: reserveError.code });
    return json({ error: "persistence_unavailable" }, 503, setCookie);
  }
  const decision = reservation.decision;
  const resultId = reservation.result_id;
  if (decision === "rate_limited") return json({ error: "rate_limited" }, 429, setCookie);
  if (decision === "exhausted") return json({ error: "exhausted" }, 409, setCookie);
  if (decision === "conflict") return json({ error: "idempotency_conflict" }, 409, setCookie);
  if (decision === "in_progress") return json({ error: "in_progress" }, 409, setCookie);
  if (decision === "forbidden" || decision === "invalid") return json({ error: "invalid" }, 400, setCookie);
  if (decision === "succeeded" && uuid(resultId)) {
    const { data: storedKey, error } = await supabase.rpc("authorize_free_trial_result", {
      p_result_id: resultId, p_guest_hash: actor.guestHash, p_owner_id: actor.userId,
    });
    const key = typeof storedKey === "string" ? storedKey : null;
    if (!error && key) {
      const { data, error: downloadError } = await supabase.storage.from(BUCKET).download(key);
      if (!downloadError && data) {
        const image = Buffer.from(await data.arrayBuffer()).toString("base64");
        return json({ petId, resultId, style: args.style, image, replayed: true }, 200, setCookie);
      }
    }
    return json({ error: "result_unavailable" }, 503, setCookie);
  }
  if (decision !== "reserved" || !uuid(resultId)) return json({ error: "persistence_unavailable" }, 503, setCookie);

  try {
    const generated = await generateTrialPolaroidImage({
      openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY?.trim() || "", maxRetries: 0 }),
      pet: { bytes: photoBytes, name: args.photo.name || "pet.jpg", type: args.photo.type },
      plate: args.plate, style: args.style, theme: args.theme,
    });
    if (!generated.imageBase64) throw new Error("free_trial_generation_empty");
    const objectKey = resultKey(resultId);
    const imageBytes = Buffer.from(generated.imageBase64, "base64");
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectKey, imageBytes, {
      contentType: "image/jpeg", upsert: true, cacheControl: "31536000",
    });
    if (uploadError) throw new Error("free_trial_storage_upload_failed");
    const { data: saved, error: saveError } = await supabase.rpc("complete_free_trial_generation", {
      p_result_id: resultId, p_pet_id: petId, p_guest_hash: actor.guestHash, p_owner_id: actor.userId,
      p_object_key: objectKey, p_style: args.style, p_theme: args.theme,
    });
    if (saveError || saved !== true) throw new Error("free_trial_persist_failed");
    return json({ petId, resultId, style: args.style, image: generated.imageBase64, replayed: false }, 200, setCookie);
  } catch (error) {
    await fail(supabase, resultId);
    console.error("[free-trial-persistence] generation or save failed", { type: error instanceof Error ? error.name : "error" });
    return json({ error: "failed" }, 500, setCookie);
  }
}

export async function claimDurableFreeTrial(cookie: string | undefined, userId: string): Promise<boolean> {
  const guestHash = freeTrialGuestHashFromCookie(cookie);
  if (!freeTrialPersistenceEnabled() || !guestHash) return false;
  const supabase = createSupabaseServerClient();
  if (!supabase) return false;
  return claimFreeTrialSession(guestHash, userId, async (verifiedGuestHash, verifiedOwnerId) => {
    const { data, error } = await supabase.rpc("claim_free_trial_guest", {
      p_guest_hash: verifiedGuestHash, p_owner_id: verifiedOwnerId,
    });
    if (error) console.error("[free-trial-persistence] guest claim failed", { code: error.code });
    return data === true;
  });
}

export async function listDurableFreeTrialResults(ownerId: string) {
  if (!freeTrialPersistenceEnabled()) return { status: "disabled" as const, results: [] };
  const supabase = createSupabaseServerClient();
  if (!supabase) return { status: "unavailable" as const, results: [] };
  return listOwnedFreeTrialResults(ownerId, async (verifiedOwnerId) => {
    const { data, error } = await supabase
      .from("free_trial_results")
      .select("result_id, pet_id, owner_user_id, style, theme, created_at")
      .eq("owner_user_id", verifiedOwnerId)
      .order("created_at", { ascending: false });
    if (error) console.error("[free-trial-persistence] result listing failed", { code: error.code });
    return { rows: data, error: !!error };
  });
}

export async function getDurableFreeTrialResult(args: {
  resultId: string;
  guestCookie?: string;
  userId: string | null;
}): Promise<Blob | null> {
  if (!freeTrialPersistenceEnabled()) return null;
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const guestHash = freeTrialGuestHashFromCookie(args.guestCookie);
  return fetchAuthorizedFreeTrialResult(
    { resultId: args.resultId, guestHash, ownerId: args.userId },
    async ({ resultId, guestHash: verifiedGuestHash, ownerId }) => {
      const { data, error } = await supabase.rpc("authorize_free_trial_result", {
        p_result_id: resultId, p_guest_hash: verifiedGuestHash, p_owner_id: ownerId,
      });
      if (error) console.error("[free-trial-persistence] result authorization failed", { code: error.code });
      return !error && typeof data === "string" ? data : null;
    },
    async (key) => {
      const { data, error } = await supabase.storage.from(BUCKET).download(key);
      return error ? null : data;
    },
  );
}
