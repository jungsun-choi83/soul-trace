import { MOOD_JOURNAL_TITLE, parseMoodJournalBody } from "@/lib/memory-library";
import { isUuid } from "@/lib/pet-first-archive";
import { privateJson, requireMemorialPet } from "@/lib/pet-first-archive-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireMemorialPet(petId);
  if (!access.ok) return access.response;

  const journal = await access.supabase
    .from("pet_mood_journal")
    .select("entry_id, body, visibility, created_at")
    .eq("owner_user_id", access.user.id)
    .eq("pet_id", access.pet.pet_id)
    .eq("visibility", "private")
    .order("created_at", { ascending: false });

  if (!journal.error) {
    return privateJson({
      entries: (journal.data ?? []).map((row) => ({
        entryId: row.entry_id,
        story: row.body,
        createdAt: row.created_at,
        visibility: "private" as const,
        persisted: true,
      })),
      shareEnabled: false,
      alertsEnabled: false,
    }, 200);
  }

  if (journal.error.code !== "PGRST205" && journal.error.code !== "42P01") {
    console.error("[mood-journal] load failed", { code: journal.error.code });
    return privateJson({ error: "unavailable" }, 503);
  }

  const fallback = await access.supabase
    .from("pet_timeline_entries")
    .select("entry_id, story, created_at")
    .eq("owner_user_id", access.user.id)
    .eq("pet_id", access.pet.pet_id)
    .eq("kind", "text")
    .eq("title", MOOD_JOURNAL_TITLE)
    .order("created_at", { ascending: false });
  if (fallback.error) {
    console.error("[mood-journal] fallback failed", { code: fallback.error.code });
    return privateJson({ error: "unavailable" }, 503);
  }
  return privateJson({
    entries: (fallback.data ?? []).map((row) => ({
      entryId: row.entry_id,
      story: row.story,
      createdAt: row.created_at,
      visibility: "private" as const,
      persisted: true,
    })),
    shareEnabled: false,
    alertsEnabled: false,
  }, 200);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireMemorialPet(petId);
  if (!access.ok) return access.response;
  const parsed = parseMoodJournalBody(await request.json().catch(() => null));
  if (!parsed.ok) return privateJson({ error: parsed.error }, 400);

  const inserted = await access.supabase
    .from("pet_mood_journal")
    .insert({
      owner_user_id: access.user.id,
      pet_id: access.pet.pet_id,
      body: parsed.value.story,
      visibility: "private",
    })
    .select("entry_id")
    .single();
  if (!inserted.error && inserted.data) {
    return privateJson({ entryId: inserted.data.entry_id, visibility: "private", persisted: true }, 201);
  }
  if (inserted.error && inserted.error.code !== "PGRST205" && inserted.error.code !== "42P01") {
    console.error("[mood-journal] save failed", { code: inserted.error.code });
    return privateJson({ error: "save_failed" }, 500);
  }

  const fallback = await access.supabase
    .from("pet_timeline_entries")
    .insert({
      owner_user_id: access.user.id,
      pet_id: access.pet.pet_id,
      kind: "text",
      title: MOOD_JOURNAL_TITLE,
      story: parsed.value.story,
      happened_on: null,
      visibility: "private",
      origin: "pet_first_archive",
    })
    .select("entry_id")
    .single();
  if (fallback.error || !fallback.data) {
    console.error("[mood-journal] fallback save failed", { code: fallback.error?.code });
    return privateJson({ error: "save_failed" }, 500);
  }
  return privateJson({ entryId: fallback.data.entry_id, visibility: "private", persisted: true }, 201);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireMemorialPet(petId);
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null) as { entryId?: unknown } | null;
  const entryId = typeof body?.entryId === "string" ? body.entryId : "";
  if (!isUuid(entryId)) return privateJson({ error: "not_found" }, 404);

  const deleted = await access.supabase
    .from("pet_mood_journal")
    .delete()
    .eq("entry_id", entryId)
    .eq("owner_user_id", access.user.id)
    .eq("pet_id", access.pet.pet_id)
    .select("entry_id");
  if (!deleted.error) {
    if (!deleted.data?.length) return privateJson({ error: "not_found" }, 404);
    return privateJson({ status: "deleted" }, 200);
  }
  if (deleted.error.code !== "PGRST205" && deleted.error.code !== "42P01") {
    return privateJson({ error: "delete_failed" }, 500);
  }

  const fallback = await access.supabase
    .from("pet_timeline_entries")
    .delete()
    .eq("entry_id", entryId)
    .eq("owner_user_id", access.user.id)
    .eq("pet_id", access.pet.pet_id)
    .eq("title", MOOD_JOURNAL_TITLE)
    .select("entry_id");
  if (fallback.error) return privateJson({ error: "delete_failed" }, 500);
  if (!fallback.data?.length) return privateJson({ error: "not_found" }, 404);
  return privateJson({ status: "deleted" }, 200);
}
