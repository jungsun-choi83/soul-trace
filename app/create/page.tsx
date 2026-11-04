import type { Metadata } from "next";

import { CreateHub } from "@/components/create-hub";
import { isPetFirstArchiveEnabled, isUuid, type LifeStatus } from "@/lib/pet-first-archive";
import { loadPetProfile, pickOwnedPet } from "@/lib/pet-first-archive-data";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "특별한 추억 만들기",
  description: "기존 AI 편지와 폴라로이드를 한곳에서 만듭니다.",
  robots: noIndexRobots,
};

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const rawPet = params.pet ?? params.petId;
  const requested = Array.isArray(rawPet) ? rawPet[0] : rawPet;

  let petId: string | null = requested && isUuid(requested) ? requested : null;
  let lifeStatus: LifeStatus = "unspecified";
  let signedIn = false;
  const rawBranch = params.branch;
  const branchValue = Array.isArray(rawBranch) ? rawBranch[0] : rawBranch;
  const branch = branchValue === "living" || branchValue === "memorial" ? branchValue : null;

  if (isPetFirstArchiveEnabled()) {
    const supabase = await createSupabaseAuthServerClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    signedIn = Boolean(user);
    if (supabase && user) {
      if (petId) {
        const result = await loadPetProfile(supabase, user.id, petId);
        if (result.status === "ok") {
          lifeStatus = result.profile.lifeStatus;
        } else {
          petId = null;
        }
      } else {
        const pet = await pickOwnedPet(supabase, user.id);
        if (pet) {
          petId = pet.petId;
          lifeStatus = pet.lifeStatus;
        }
      }
    }
  }

  if (lifeStatus === "unspecified" && branch) lifeStatus = branch;

  return <CreateHub petId={petId} lifeStatus={lifeStatus} signedIn={signedIn} />;
}
