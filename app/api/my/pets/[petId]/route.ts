import { parsePetPatchInput, petPatchRow } from "@/lib/pet-first-archive";
import { privateJson, requireOwnedPet } from "@/lib/pet-first-archive-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;
  return privateJson({
    petId: access.pet.pet_id,
    petName: access.pet.pet_name,
    lifeStatus: access.pet.life_status ?? "unspecified",
    species: access.pet.species ?? null,
    birthday: access.pet.birthday ?? null,
    adoptedOn: access.pet.adopted_on ?? null,
    traits: access.pet.traits ?? null,
  }, 200);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;
  const parsed = parsePetPatchInput(await request.json().catch(() => null));
  if (!parsed.ok) return privateJson({ error: parsed.error }, 400);
  const { data, error } = await access.supabase
    .from("soul_trace_pets")
    .update(petPatchRow(parsed.value, new Date().toISOString()))
    .eq("pet_id", access.pet.pet_id)
    .eq("owner_user_id", access.user.id)
    .select("pet_id, pet_name, life_status, species, birthday, adopted_on, traits")
    .single();
  if (error || !data) {
    console.error("[pet-first] pet update failed", { code: error?.code });
    return privateJson({ error: "save_failed" }, 500);
  }
  return privateJson({
    petId: data.pet_id,
    petName: data.pet_name,
    lifeStatus: data.life_status,
    species: data.species,
    birthday: data.birthday,
    adoptedOn: data.adopted_on,
    traits: data.traits,
  }, 200);
}
