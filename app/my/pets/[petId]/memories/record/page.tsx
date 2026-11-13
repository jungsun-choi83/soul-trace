import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PetFirstMemory } from "@/components/pet-first-memory";
import { PetFirstUnavailable } from "@/components/pet-first-unavailable";
import { authEntryPath } from "@/lib/auth-redirect";
import { isPetFirstArchiveEnabled, isUuid, seoulToday } from "@/lib/pet-first-archive";
import { loadPetProfile } from "@/lib/pet-first-archive-data";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Record a Memory",
  description: "Add a photo, video, or written memory for your pet.",
  robots: noIndexRobots,
};

export default async function PetMemoryRecordPage({ params }: { params: Promise<{ petId: string }> }) {
  if (!isPetFirstArchiveEnabled()) notFound();
  const { petId } = await params;
  if (!isUuid(petId)) notFound();

  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(authEntryPath(`/my/pets/${petId}/memories/record`));

  const result = await loadPetProfile(supabase, user.id, petId);
  if (result.status === "unavailable") return <PetFirstUnavailable />;
  if (result.status === "not_found") notFound();

  return <PetFirstMemory profile={result.profile} today={seoulToday()} view="record" />;
}
