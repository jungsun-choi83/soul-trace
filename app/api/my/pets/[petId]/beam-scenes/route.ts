import { beamDualDisplay, createBeamSceneDraft, isBeamPlace } from "@/lib/memory-library";
import { isUuid } from "@/lib/pet-first-archive";
import { privateJson, requireOwnedPet } from "@/lib/pet-first-archive-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;

  const result = await access.supabase
    .from("beam_scene_previews")
    .select("scene_id, title, happened_on, place_kind, original_asset_id, derivative_asset_id, dual_display, playback_ready, created_at")
    .eq("owner_user_id", access.user.id)
    .eq("pet_id", access.pet.pet_id)
    .order("created_at", { ascending: false });

  if (result.error) {
    if (result.error.code === "PGRST205" || result.error.code === "42P01") {
      return privateJson({ scenes: [], persistAvailable: false, hardwarePlayback: false }, 200);
    }
    console.error("[beam-scene] load failed", { code: result.error.code });
    return privateJson({ error: "unavailable" }, 503);
  }

  return privateJson({
    scenes: result.data ?? [],
    persistAvailable: true,
    hardwarePlayback: false,
  }, 200);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return privateJson({ error: "invalid_scene" }, 400);
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
  const place = isBeamPlace(body.place) ? body.place : "home";
  const happenedOn = typeof body.happenedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.happenedOn) ? body.happenedOn : null;
  const originalAssetId = typeof body.originalAssetId === "string" && isUuid(body.originalAssetId) ? body.originalAssetId : null;
  const draft = createBeamSceneDraft({
    petId: access.pet.pet_id,
    title,
    place,
    happenedOn,
    assetId: originalAssetId,
  });
  const dual = beamDualDisplay(draft);

  const inserted = await access.supabase
    .from("beam_scene_previews")
    .insert({
      owner_user_id: access.user.id,
      pet_id: access.pet.pet_id,
      title: draft.title || null,
      happened_on: draft.happenedOn,
      place_kind: draft.place,
      original_asset_id: originalAssetId,
      derivative_asset_id: null,
      dual_display: dual,
      playback_ready: false,
    })
    .select("scene_id")
    .single();

  if (inserted.error) {
    if (inserted.error.code === "PGRST205" || inserted.error.code === "42P01") {
      return privateJson({ persisted: false, hardwarePlayback: false, dualDisplay: dual }, 200);
    }
    console.error("[beam-scene] save failed", { code: inserted.error.code });
    return privateJson({ error: "save_failed" }, 500);
  }
  return privateJson({
    sceneId: inserted.data?.scene_id,
    persisted: true,
    hardwarePlayback: false,
    dualDisplay: dual,
  }, 201);
}
