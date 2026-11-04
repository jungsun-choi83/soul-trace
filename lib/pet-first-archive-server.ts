import "server-only";

import { NextResponse } from "next/server";

import { decidePetAccess, isPetFirstArchiveEnabled, isUuid } from "@/lib/pet-first-archive";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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
  const ensured = await supabase.rpc("ensure_soul_trace_owner");
  if (!ensured.error) return null;
  const admin = createSupabaseServerClient();
  const ownerId = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (admin && ownerId) {
    const inserted = await admin.from("soul_trace_owners").upsert({ user_id: ownerId }, { onConflict: "user_id" });
    if (!inserted.error) return null;
    console.error("[pet-first] owner setup failed", { code: inserted.error.code });
  } else {
    console.error("[pet-first] owner setup failed", { code: ensured.error.code });
  }
  return privateJson({ error: "unavailable" }, 503);
}

const PET_SELECT = "pet_id, owner_user_id, pet_name, life_status, species, birthday, adopted_on, traits, created_at";
const PET_SELECT_BASE = "pet_id, owner_user_id, pet_name, created_at";

export async function selectOwnedPet(supabase: AuthClient, userId: string, petId: string) {
  const full = await supabase
    .from("soul_trace_pets")
    .select(PET_SELECT)
    .eq("pet_id", petId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!full.error) return full;
  if (full.error.code !== "42703") return full;
  return supabase
    .from("soul_trace_pets")
    .select(PET_SELECT_BASE)
    .eq("pet_id", petId)
    .eq("owner_user_id", userId)
    .maybeSingle();
}

export { privateJson };
