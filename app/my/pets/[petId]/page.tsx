import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PetFirstProfile } from "@/components/pet-first-profile";
import { PetFirstUnavailable } from "@/components/pet-first-unavailable";
import { authEntryPath } from "@/lib/auth-redirect";
import { isPetFirstArchiveEnabled, isUuid, seoulToday } from "@/lib/pet-first-archive";
import { loadPetProfile } from "@/lib/pet-first-archive-data";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "우리 아이의 앨범",
  description: "반려동물 사진과 이야기를 편지 없이 저장합니다.",
  robots: noIndexRobots,
};

export default async function PetMemoryPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  if (!isPetFirstArchiveEnabled()) notFound();
  const { petId } = await params;
  if (!isUuid(petId)) notFound();
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(authEntryPath(`/my/pets/${petId}`));

  const result = await loadPetProfile(supabase, user.id, petId);
  if (result.status === "unavailable") return <PetFirstUnavailable />;
  if (result.status === "not_found") notFound();

  return <PetFirstProfile profile={result.profile} today={seoulToday()} />;
}
