import { parsePetCreateInput, petInsertRow } from "@/lib/pet-first-archive";
import { ensureOwnerRow, privateJson, requirePetFirstUser } from "@/lib/pet-first-archive-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const FULL_SELECT = "pet_id, pet_name, life_status, species, birthday, adopted_on, traits, created_at";
const BASE_SELECT = "pet_id, pet_name, created_at";

function publicPet(data: {
  pet_id: string;
  pet_name: string;
  life_status?: string | null;
  species?: string | null;
  birthday?: string | null;
  adopted_on?: string | null;
  traits?: string | null;
  created_at: string;
}) {
  return {
    petId: data.pet_id,
    petName: data.pet_name,
    lifeStatus: data.life_status ?? "unspecified",
    species: data.species ?? null,
    birthday: data.birthday ?? null,
    adoptedOn: data.adopted_on ?? null,
    traits: data.traits ?? null,
    createdAt: data.created_at,
  };
}

export async function GET() {
  const access = await requirePetFirstUser();
  if (!access.ok) return access.response;
  const full = await access.supabase
    .from("soul_trace_pets")
    .select(FULL_SELECT)
    .eq("owner_user_id", access.user.id)
    .order("created_at", { ascending: false });
  const result = !full.error || full.error.code !== "42703"
    ? full
    : await access.supabase
      .from("soul_trace_pets")
      .select(BASE_SELECT)
      .eq("owner_user_id", access.user.id)
      .order("created_at", { ascending: false });
  if (result.error) {
    console.error("[pet-first] pet list failed", { code: result.error.code });
    return privateJson({ error: "unavailable" }, 503);
  }
  return privateJson({ pets: (result.data ?? []).map(publicPet) }, 200);
}

export async function POST(request: Request) {
  const access = await requirePetFirstUser();
  if (!access.ok) return access.response;
  const unavailable = await ensureOwnerRow(access.supabase, access.user.id);
  if (unavailable) return unavailable;
  const parsed = parsePetCreateInput(await request.json().catch(() => null));
  if (!parsed.ok) return privateJson({ error: parsed.error }, 400);

  const row = petInsertRow(access.user.id, parsed.value);
  const admin = createSupabaseServerClient();
  const writer = admin ?? access.supabase;
  const created = await writer.from("soul_trace_pets").insert(row).select(FULL_SELECT).single();
  if (!created.error && created.data) {
    return privateJson(publicPet(created.data), 201);
  }

  const missingColumn = created.error?.code === "42703";
  const fallback = await writer
    .from("soul_trace_pets")
    .insert({ owner_user_id: access.user.id, pet_name: parsed.value.petName })
    .select(BASE_SELECT)
    .single();
  if (!fallback.error && fallback.data) {
    return privateJson(publicPet({ ...fallback.data, ...parsed.value, adopted_on: parsed.value.adoptedOn }), 201);
  }

  console.error("[pet-first] pet create failed", {
    code: fallback.error?.code ?? created.error?.code,
    missingColumn,
  });
  return privateJson({ error: "save_failed" }, 500);
}
