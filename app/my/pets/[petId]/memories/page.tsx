import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PetFirstMemory } from "@/components/pet-first-memory";
import { PetFirstUnavailable } from "@/components/pet-first-unavailable";
import { authEntryPath } from "@/lib/auth-redirect";
import { isPetFirstArchiveEnabled, isUuid, seoulToday } from "@/lib/pet-first-archive";
import { loadPetProfile } from "@/lib/pet-first-archive-data";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Pet Memories",
  description: "A pet's saved memories, organized by date.",
  robots: noIndexRobots,
};

export default async function PetMemoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ petId: string }>;
  searchParams: Promise<ServerSearchParams>;
}) {
  if (!isPetFirstArchiveEnabled()) notFound();
  const { petId } = await params;
  if (!isUuid(petId)) notFound();
  const query = await searchParams;
  const rawEntry = query.entry;
  const entryId = Array.isArray(rawEntry) ? rawEntry[0] : rawEntry ?? null;
  const rawPane = query.pane;
  const paneValue = Array.isArray(rawPane) ? rawPane[0] : rawPane;
  const returnPane = paneValue === "collection" || paneValue === "together" ? paneValue : "album";
  const rawFolder = query.folder;
  const folderValue = Array.isArray(rawFolder) ? rawFolder[0] : rawFolder;
  const folderKey = folderValue && /^\d{4}-(0[1-9]|1[0-2])$/.test(folderValue) ? folderValue : null;

  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(authEntryPath(`/my/pets/${petId}/memories`));

  const result = await loadPetProfile(supabase, user.id, petId);
  if (result.status === "unavailable") return <PetFirstUnavailable />;
  if (result.status === "not_found") notFound();

  return <PetFirstMemory key={`${entryId ?? "album"}-${returnPane}-${folderKey ?? "folders"}`} profile={result.profile} today={seoulToday()} view={entryId ? "detail" : "album"} entryId={entryId} returnPane={returnPane} folderKey={folderKey} />;
}
