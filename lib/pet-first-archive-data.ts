import "server-only";

import { isMissingRelationError, type LifeStatus } from "@/lib/pet-first-archive";
import { takeRecentRowsPerPet } from "@/lib/home-memory-preview";
import type { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

let timelineRelationMissing = false;

function noteTimelineAvailability(code: string | undefined | null) {
  if (isMissingRelationError(code)) timelineRelationMissing = true;
}

export function skipPetTimelineQuery() {
  return timelineRelationMissing;
}

export function rememberMissingTimeline(code: string | undefined | null) {
  noteTimelineAvailability(code);
}

type AuthClient = NonNullable<Awaited<ReturnType<typeof createSupabaseAuthServerClient>>>;

export type HomePet = {
  petId: string;
  petName: string;
  lifeStatus: LifeStatus;
  species: string | null;
  createdAt: string;
  entryDays: string[];
  letterCount: number;
  avatarUrl: string | null;
};

export type HomeRecent = {
  entryId: string;
  petId: string;
  petName: string;
  kind: "photo" | "video" | "text";
  title: string | null;
  story: string | null;
  happenedOn: string | null;
  createdAt: string;
  imageUrl: string | null;
};

type EntryRow = {
  entry_id: string;
  pet_id: string;
  kind: "photo" | "video" | "text";
  title: string | null;
  story: string | null;
  happened_on: string | null;
  created_at: string;
  pet_timeline_assets: { storage_bucket: string; storage_path: string; content_type: string; asset_order: number }[] | null;
};

async function loadOwnedPetRows(supabase: AuthClient, userId: string) {
  const petsFull = await supabase
    .from("soul_trace_pets")
    .select("pet_id, pet_name, life_status, species, created_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  return !petsFull.error || petsFull.error.code !== "42703"
    ? petsFull
    : await supabase
      .from("soul_trace_pets")
      .select("pet_id, pet_name, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });
}

export async function loadPetHome(supabase: AuthClient, userId: string) {
  const petsResult = await loadOwnedPetRows(supabase, userId);
  if (petsResult.error) {
    console.error("[pet-first] home load failed", { pets: petsResult.error.code });
    return null;
  }

  const [lettersResult, entriesResult] = await Promise.all([
    supabase
      .from("soul_trace_submissions")
      .select("pet_id")
      .eq("owner_user_id", userId),
    timelineRelationMissing
      ? Promise.resolve({ data: [] as EntryRow[], error: null })
      : supabase
        .from("pet_timeline_entries")
        .select("entry_id, pet_id, kind, title, story, happened_on, created_at, pet_timeline_assets(storage_bucket, storage_path, content_type, asset_order)")
        .eq("owner_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(400),
  ]);
  noteTimelineAvailability(entriesResult.error?.code);
  if (lettersResult.error) {
    console.error("[pet-first] letters unavailable", { code: lettersResult.error.code });
    return null;
  }
  if (entriesResult.error && !isMissingRelationError(entriesResult.error.code)) {
    console.error("[pet-first] timeline unavailable", { code: entriesResult.error.code });
    return null;
  }

  const entries = (entriesResult.error ? [] : entriesResult.data ?? []) as EntryRow[];
  const letters = lettersResult.data ?? [];
  const pets: HomePet[] = await Promise.all((petsResult.data ?? []).map(async (pet) => {
    const image = entries
      .filter((entry) => entry.pet_id === pet.pet_id)
      .flatMap((entry) => entry.pet_timeline_assets ?? [])
      .filter((asset) => asset.content_type.startsWith("image/"))
      .sort((a, b) => a.asset_order - b.asset_order)[0];
    const signed = image
      ? await supabase.storage.from(image.storage_bucket).createSignedUrl(image.storage_path, 3600)
      : null;
    return {
      petId: pet.pet_id,
      petName: pet.pet_name,
      lifeStatus: ((pet as { life_status?: LifeStatus }).life_status ?? "unspecified") as LifeStatus,
      species: (pet as { species?: string | null }).species ?? null,
      createdAt: pet.created_at,
      entryDays: entries
        .filter((entry) => entry.pet_id === pet.pet_id)
        .map((entry) => entry.happened_on ?? entry.created_at.slice(0, 10)),
      letterCount: letters.filter((letter) => letter.pet_id === pet.pet_id).length,
      avatarUrl: signed?.data?.signedUrl ?? null,
    };
  }));
  const names = new Map(pets.map((pet) => [pet.petId, pet.petName]));

  const recentEntries = takeRecentRowsPerPet(entries, (entry) => entry.pet_id, 6);
  const recent: HomeRecent[] = await Promise.all(recentEntries.map(async (entry) => {
    const image = [...(entry.pet_timeline_assets ?? [])]
      .sort((a, b) => a.asset_order - b.asset_order)
      .find((asset) => asset.content_type.startsWith("image/"));
    const signed = image
      ? await supabase.storage.from(image.storage_bucket).createSignedUrl(image.storage_path, 3600)
      : null;
    return {
      entryId: entry.entry_id,
      petId: entry.pet_id,
      petName: names.get(entry.pet_id) ?? "",
      kind: entry.kind,
      title: entry.title,
      story: entry.story,
      happenedOn: entry.happened_on,
      createdAt: entry.created_at,
      imageUrl: signed?.data?.signedUrl ?? null,
    };
  }));

  return { pets, recent };
}

export async function loadPetProfile(supabase: AuthClient, userId: string, petId: string) {
  const [petResult, lettersResult] = await Promise.all([
    supabase
      .from("soul_trace_pets")
      .select("pet_id, pet_name, life_status, species, birthday, adopted_on, traits")
      .eq("pet_id", petId)
      .eq("owner_user_id", userId)
      .maybeSingle(),
    supabase
      .from("soul_trace_submissions")
      .select("submission_id", { count: "exact", head: true })
      .eq("pet_id", petId)
      .eq("owner_user_id", userId),
  ]);
  const pet = !petResult.error || petResult.error.code !== "42703"
    ? petResult
    : await supabase
      .from("soul_trace_pets")
      .select("pet_id, pet_name, created_at")
      .eq("pet_id", petId)
      .eq("owner_user_id", userId)
      .maybeSingle();
  if (pet.error) {
    console.error("[pet-first] profile load failed", { code: pet.error.code });
    return { status: "unavailable" as const };
  }
  if (!pet.data || pet.data.pet_id !== petId) return { status: "not_found" as const };
  return {
    status: "ok" as const,
    profile: {
      petId: pet.data.pet_id,
      petName: pet.data.pet_name,
      lifeStatus: ((pet.data as { life_status?: LifeStatus }).life_status ?? "unspecified") as LifeStatus,
      species: (pet.data as { species?: string | null }).species ?? null,
      birthday: (pet.data as { birthday?: string | null }).birthday ?? null,
      adoptedOn: (pet.data as { adopted_on?: string | null }).adopted_on ?? null,
      traits: (pet.data as { traits?: string | null }).traits ?? null,
      letterCount: lettersResult.error ? 0 : lettersResult.count ?? 0,
    },
  };
}

export type PetProfile = Extract<Awaited<ReturnType<typeof loadPetProfile>>, { status: "ok" }>["profile"];

export async function pickOwnedPet(
  supabase: AuthClient,
  userId: string,
  prefer?: LifeStatus,
) {
  const petsResult = await loadOwnedPetRows(supabase, userId);
  if (petsResult.error) {
    console.error("[pet-first] pet list failed", { code: petsResult.error.code });
    return null;
  }
  const pets = (petsResult.data ?? []).map((pet) => ({
    petId: pet.pet_id as string,
    petName: pet.pet_name as string,
    lifeStatus: ((pet as { life_status?: LifeStatus }).life_status ?? "unspecified") as LifeStatus,
  }));
  if (prefer) return pets.find((pet) => pet.lifeStatus === prefer) ?? null;
  return pets[0] ?? null;
}
