import { PolaroidEntry } from "@/components/polaroid-entry";
import {
  isChristmasPolaroidEnabled,
  isPolaroidArtAllEnabled,
  isYearRoundPolaroidEnabled,
} from "@/lib/polaroid-theme-catalog";
import type { ServerSearchParams } from "@/lib/search-params";
import { authEntryPath } from "@/lib/auth-redirect";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { hrefWithSearchParams } from "@/lib/search-params";
import { isSeasonalPolaroidEnabled } from "@/lib/seasonal-polaroid-feature";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "우리 아이의 특별한 한 장 | Soul Trace",
  description: "사진 한 장과 우리 아이의 작은 이야기가 만나 특별한 추억이 됩니다.",
  alternates: { canonical: "/polaroid" },
};

export default async function PolaroidPage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const returnTo = hrefWithSearchParams("/polaroid", params);
  const authClient = await createSupabaseAuthServerClient();
  const authUser = authClient ? (await authClient.auth.getUser()).data.user : null;
  if (!authUser) redirect(authEntryPath(returnTo));

  const rawPet = params.petId ?? params.pet;
  const initialPetId = Array.isArray(rawPet) ? rawPet[0] : rawPet;
  const rawResumeDraft = params.resumeDraft;
  const resumeDraft = (Array.isArray(rawResumeDraft) ? rawResumeDraft[0] : rawResumeDraft) === "1";
  const rawMemoryEntryId = params.memoryEntryId;
  const initialMemoryEntryId = Array.isArray(rawMemoryEntryId) ? rawMemoryEntryId[0] : rawMemoryEntryId;
  const rawMemoryAssetId = params.memoryAssetId;
  const initialMemoryAssetId = Array.isArray(rawMemoryAssetId) ? rawMemoryAssetId[0] : rawMemoryAssetId;
  return (
    <PolaroidEntry
      generationEnabled={isSeasonalPolaroidEnabled()}
      yearRoundEnabled={isYearRoundPolaroidEnabled()}
      christmasEnabled={isChristmasPolaroidEnabled()}
      artAllEnabled={isPolaroidArtAllEnabled()}
      initialPetId={initialPetId}
      resumeDraft={resumeDraft}
      initialMemoryEntryId={initialMemoryEntryId}
      initialMemoryAssetId={initialMemoryAssetId}
    />
  );
}
