import "server-only";

import { NextResponse } from "next/server";

import { decidePetAccess, isPetFirstArchiveEnabled, isUuid } from "@/lib/pet-first-archive";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  logOwnerSetupDiagnostic,
  runOwnerSetup,
  sanitizeOwnerSetupCode,
  sanitizeOwnerSetupDiagnostic,
  type OwnerSetupAttempt,
  type OwnerSetupError,
} from "@/lib/owner-row-setup";

type AuthClient = NonNullable<Awaited<ReturnType<typeof createSupabaseAuthServerClient>>>;

function privateJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function requirePetFirstUser() {
  if (!isPetFirstArchiveEnabled()) {
    return { ok: false as const, response: privateJson({ error: "not_found" }, 404) };
  }
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) {
    return { ok: false as const, response: privateJson({ error: "authentication_required" }, 401) };
  }
  return { ok: true as const, supabase, user };
}

export async function requireOwnedPet(petId: string) {
  const access = await requirePetFirstUser();
  if (!access.ok) return access;
  if (!isUuid(petId)) {
    return { ok: false as const, response: privateJson({ error: "not_found" }, 404) };
  }
  const { data, error } = await selectOwnedPet(access.supabase, access.user.id, petId);
  if (error) {
    console.error("[pet-first] pet lookup failed", { code: error.code });
    return { ok: false as const, response: privateJson({ error: "unavailable" }, 503) };
  }
  if (decidePetAccess(access.user.id, data?.owner_user_id ?? null) !== "ok" || !data) {
    return { ok: false as const, response: privateJson({ error: "not_found" }, 404) };
  }
  return { ok: true as const, supabase: access.supabase, user: access.user, pet: data };
}

function petLifeStatus(pet: { life_status?: string | null }): "living" | "memorial" | "unspecified" {
  return pet.life_status === "living" || pet.life_status === "memorial" ? pet.life_status : "unspecified";
}

export async function requireMemorialPet(petId: string) {
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access;
  if (petLifeStatus(access.pet) !== "memorial") {
    return { ok: false as const, response: privateJson({ error: "not_memorial" }, 403) };
  }
  return access;
}

export async function requireLivingPet(petId: string) {
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access;
  if (petLifeStatus(access.pet) !== "living") {
    return { ok: false as const, response: privateJson({ error: "not_living" }, 403) };
  }
  return access;
}

export async function ensureOwnerRow(supabase: AuthClient, userId?: string) {
  const result = await runOwnerSetup(
    async (): Promise<OwnerSetupAttempt> => {
      const { error } = await supabase.rpc("ensure_soul_trace_owner");
      return error ? { ok: false, error } : { ok: true };
    },
    async (): Promise<OwnerSetupAttempt> => {
      const admin = createSupabaseServerClient();
      if (!admin) return { ok: false, unavailable: true, reason: "service_client_unavailable" };
      const ownerId = userId ?? (await supabase.auth.getUser()).data.user?.id;
      if (!ownerId) return { ok: false, unavailable: true, reason: "owner_id_unavailable" };
      const { error } = await admin.from("soul_trace_owners").upsert(
        { user_id: ownerId },
        { onConflict: "user_id" },
      );
      return error ? { ok: false, error } : { ok: true };
    },
  );

  if (result.ok) {
    if (result.rpcError) logOwnerSetupFailure("rpc", result.rpcError, false);
    return null;
  }

  logOwnerSetupFailure("rpc", result.rpcError, true);
  if (result.fallbackError) logOwnerSetupFailure("fallback", result.fallbackError, true);
  else logOwnerSetupFailure("fallback", null, true, result.fallbackUnavailableReason);
  return privateJson({ error: "unavailable" }, 503);
}

function logOwnerSetupFailure(
  stage: "rpc" | "fallback",
  error: OwnerSetupError | null,
  terminal: boolean,
  unavailableReason?: string,
) {
  if (process.env.NODE_ENV === "development") {
    logOwnerSetupDiagnostic(terminal, {
      stage,
      terminal,
      code: sanitizeOwnerSetupCode(error?.code),
      message: sanitizeOwnerSetupDiagnostic(error?.message),
      hint: sanitizeOwnerSetupDiagnostic(error?.hint),
      fallbackUnavailableReason: unavailableReason,
    });
    return;
  }
  if (terminal) console.error("[pet-first] owner setup failed", { stage });
}

const PET_SELECT = "pet_id, owner_user_id, pet_name, life_status, species, birthday, adopted_on, traits, created_at";
const PET_SELECT_BASE = "pet_id, owner_user_id, pet_name, created_at";

type OwnedPetRow = {
  pet_id: string;
  owner_user_id: string;
  pet_name: string;
  created_at: string;
  life_status?: string | null;
  species?: string | null;
  birthday?: string | null;
  adopted_on?: string | null;
  traits?: string | null;
};

export async function selectOwnedPet(supabase: AuthClient, userId: string, petId: string) {
  const full = await supabase
    .from("soul_trace_pets")
    .select(PET_SELECT)
    .eq("pet_id", petId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!full.error) return { ...full, data: full.data as OwnedPetRow | null };
  if (full.error.code !== "42703") return { ...full, data: null as OwnedPetRow | null };
  const fallback = await supabase
    .from("soul_trace_pets")
    .select(PET_SELECT_BASE)
    .eq("pet_id", petId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  return { ...fallback, data: fallback.data as OwnedPetRow | null };
}

export { privateJson };
