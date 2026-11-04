import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CollarStudioRoute } from "@/components/collar-studio";
import { DeviceLivingOnly } from "@/components/device-living-only";
import { PetFirstUnavailable } from "@/components/pet-first-unavailable";
import { authEntryPath } from "@/lib/auth-redirect";
import { decideDeviceAccess } from "@/lib/memory-library";
import { isPetFirstArchiveEnabled, isUuid } from "@/lib/pet-first-archive";
import { loadPetHome, loadPetProfile } from "@/lib/pet-first-archive-data";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "스마트 목걸이",
  description: "스마트 목걸이 화면을 미리 봅니다. 실제 블루투스 연결은 아직 없습니다.",
  robots: noIndexRobots,
};

export default async function DevicePage({
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
  if (!supabase || !user) {
    if (petId) redirect(authEntryPath(`/my/device?pet=${petId}`));
    return <CollarStudioRoute step="hub" pet={null} />;
  }

  if (!petId || !isUuid(petId)) {
    const home = await loadPetHome(supabase, user.id);
    const pets = home?.pets ?? [];
    const collarPet = pets.find((pet) => pet.lifeStatus === "living") ?? pets.find((pet) => pet.lifeStatus !== "memorial");
    if (collarPet) redirect(`/my/device?pet=${collarPet.petId}`);
    const memorial = pets.find((pet) => pet.lifeStatus === "memorial");
    if (memorial) return <DeviceLivingOnly petName={memorial.petName} />;
    return <CollarStudioRoute step="hub" pet={null} />;
  }

  const result = await loadPetProfile(supabase, user.id, petId);
  if (result.status === "unavailable") return <PetFirstUnavailable />;
  if (result.status === "not_found") notFound();
  if (decideDeviceAccess(user.id, user.id, result.profile.lifeStatus) === "not_living") {
    return <DeviceLivingOnly petName={result.profile.petName} />;
  }

  return <CollarStudioRoute step="hub" pet={{ petId: result.profile.petId, petName: result.profile.petName }} />;
}
