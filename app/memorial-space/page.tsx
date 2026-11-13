import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { MemorialSpace, MemorialSpaceClosed } from "@/components/memorial-space";
import { PetFirstUnavailable } from "@/components/pet-first-unavailable";
import { decideMemorialSpaceAccess } from "@/lib/memory-library";
import { isPetFirstArchiveEnabled, isUuid, seoulToday } from "@/lib/pet-first-archive";
import { guestPreviewProfile, loadPetProfile, pickOwnedPet } from "@/lib/pet-first-archive-data";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "추모관",
  description: "떠나보낸 아이의 보호자만 보는 개인 기억 공간입니다. 기존 AI 편지 페이지와는 다릅니다.",
  robots: noIndexRobots,
};

export default async function MemorialSpacePage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  if (!isPetFirstArchiveEnabled()) notFound();
  const params = await searchParams;
  const rawPet = params.pet;
  const petId = Array.isArray(rawPet) ? rawPet[0] : rawPet;

  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) return <MemorialSpace profile={guestPreviewProfile("memorial")} today={seoulToday()} />;
  if (!petId || !isUuid(petId)) {
    const memorialPet = await pickOwnedPet(supabase, user.id, "memorial");
    if (!memorialPet) return <MemorialSpaceClosed reason="not_memorial" />;
    redirect(`/memorial-space?pet=${memorialPet.petId}`);
  }

  const result = await loadPetProfile(supabase, user.id, petId);
  if (result.status === "unavailable") return <PetFirstUnavailable />;
  if (result.status === "not_found") return <MemorialSpaceClosed reason="not_found" />;

  const access = decideMemorialSpaceAccess(user.id, user.id, result.profile.lifeStatus);
  if (access === "not_memorial") return <MemorialSpaceClosed reason="not_memorial" />;

  return <MemorialSpace profile={result.profile} today={seoulToday()} />;
}
