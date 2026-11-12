export type SeasonalPolaroidPetProfile = {
  petId: string;
  petName: string;
  species: string | null;
  lifeStatus: string;
};

export function polaroidStatusFromLifeStatus(value: unknown): "living" | "passed" | null {
  if (value === "living") return "living";
  if (value === "memorial") return "passed";
  return null;
}

export function seasonalPolaroidDraftKey(petId?: string | null): string {
  return petId
    ? `soul-trace-seasonal-polaroid-draft:pet:${petId.toLowerCase()}`
    : "soul-trace-seasonal-polaroid-draft";
}

export function parseSeasonalPolaroidPetProfile(value: unknown, expectedPetId: string): SeasonalPolaroidPetProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.petId !== "string" || row.petId.toLowerCase() !== expectedPetId.toLowerCase()
    || typeof row.petName !== "string" || !row.petName.trim()
    || !(typeof row.species === "string" || row.species === null)
    || typeof row.lifeStatus !== "string"
  ) return null;
  return {
    petId: row.petId,
    petName: row.petName,
    species: row.species,
    lifeStatus: row.lifeStatus,
  };
}
