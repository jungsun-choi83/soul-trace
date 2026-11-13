import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BeamScenePreview } from "@/components/beam-scene-preview";
import { PetFirstUnavailable } from "@/components/pet-first-unavailable";
import { isPetFirstArchiveEnabled, isUuid } from "@/lib/pet-first-archive";
import { guestPreviewProfile, loadPetProfile, pickOwnedPet } from "@/lib/pet-first-archive-data";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Eternal Beam 장면 미리보기",
  description: "아카이브 사진으로 Eternal Beam 장면을 구성합니다. 기기 전송은 아직 없습니다.",
  robots: noIndexRobots,
};

export default async function BeamScenePage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  if (!isPetFirstArchiveEnabled()) notFound();
  const params = await searchParams;
  const rawPet = params.pet;
  const petId = Array.isArray(rawPet) ? rawPet[0] : rawPet;
  const rawEntry = params.entry;
  const rawAsset = params.asset;

  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) {
    return (
      <BeamScenePreview
        profile={guestPreviewProfile()}
        initialEntryId={Array.isArray(rawEntry) ? rawEntry[0] : rawEntry}
        initialAssetId={Array.isArray(rawAsset) ? rawAsset[0] : rawAsset}
      />
    );
  }
  if (!petId || !isUuid(petId)) {
    const pet = await pickOwnedPet(supabase, user.id);
    if (!pet) redirect("/my/pets/new");
    redirect(`/beam-scene?pet=${pet.petId}`);
  }

  const result = await loadPetProfile(supabase, user.id, petId);
  if (result.status === "unavailable") return <PetFirstUnavailable />;
  if (result.status === "not_found") notFound();

  return (
    <BeamScenePreview
      profile={result.profile}
      initialEntryId={Array.isArray(rawEntry) ? rawEntry[0] : rawEntry}
      initialAssetId={Array.isArray(rawAsset) ? rawAsset[0] : rawAsset}
    />
  );
}
