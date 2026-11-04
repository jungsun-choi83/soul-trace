import { PolaroidEntry } from "@/components/polaroid-entry";
import {
  isChristmasPolaroidEnabled,
  isPolaroidArtAllEnabled,
  isYearRoundPolaroidEnabled,
} from "@/lib/polaroid-theme-catalog";
import type { ServerSearchParams } from "@/lib/search-params";
import { isSeasonalPolaroidEnabled } from "@/lib/seasonal-polaroid-feature";
import type { Metadata } from "next";

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
  const rawPet = params.petId ?? params.pet;
  const initialPetId = Array.isArray(rawPet) ? rawPet[0] : rawPet;
  return (
    <PolaroidEntry
      generationEnabled={isSeasonalPolaroidEnabled()}
      yearRoundEnabled={isYearRoundPolaroidEnabled()}
      christmasEnabled={isChristmasPolaroidEnabled()}
      artAllEnabled={isPolaroidArtAllEnabled()}
      initialPetId={initialPetId}
    />
  );
}
