import { isUuid } from "@/lib/pet-first-archive";
import { loadPetProfile } from "@/lib/pet-first-archive-data";
import type { ServerSearchParams } from "@/lib/search-params";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export async function collarStudioPet(params: ServerSearchParams) {
  const raw = params.pet;
  const petId = Array.isArray(raw) ? raw[0] : raw;
  if (!petId || !isUuid(petId)) return null;
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) return { petId, petName: "우리 아이" };
  const result = await loadPetProfile(supabase, user.id, petId);
  if (result.status !== "ok" || result.profile.lifeStatus === "memorial") return null;
  return { petId: result.profile.petId, petName: result.profile.petName };
}
