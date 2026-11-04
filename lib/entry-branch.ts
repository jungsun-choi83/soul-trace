import type { LifeStatus } from "./pet-first-archive.ts";

export type EntryBranch = "living" | "memorial";

/** Anonymous first choice. Never written to soul_trace_pets.life_status. */
export const ENTRY_BRANCH_KEY = "soultrace.entry.branch";

export type BranchPetRef = {
  petId: string;
  lifeStatus: LifeStatus;
};

export function entryHomePath(branch: EntryBranch, petId?: string | null): string {
  const base = branch === "memorial" ? "/dashboard/memorial" : "/dashboard/living";
  return petId ? `${base}?pet=${encodeURIComponent(petId)}` : base;
}

export function writeEntryBranch(
  storage: Pick<Storage, "setItem"> | null | undefined,
  branch: EntryBranch,
): void {
  try {
    storage?.setItem(ENTRY_BRANCH_KEY, branch);
  } catch {
    // Private mode still follows the link.
  }
}

export function readEntryBranch(
  storage: Pick<Storage, "getItem"> | null | undefined,
): EntryBranch | null {
  try {
    const value = storage?.getItem(ENTRY_BRANCH_KEY);
    return value === "living" || value === "memorial" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Logged-in /dashboard destination.
 * Uses soul_trace_pets.life_status only. Letter rows are not an input.
 * Unspecified pets stay on the choice screen until a profile save confirms them.
 * Mixed living and memorial pets stay on the choice screen until one is selected.
 */
export function dashboardHomePath(pets: BranchPetRef[], selectedPetId?: string | null): string {
  const selected = selectedPetId ? pets.find((pet) => pet.petId === selectedPetId) : undefined;
  if (selected?.lifeStatus === "living" || selected?.lifeStatus === "memorial") {
    return entryHomePath(selected.lifeStatus, selected.petId);
  }
  if (selected?.lifeStatus === "unspecified") {
    return `/choose?pet=${encodeURIComponent(selected.petId)}`;
  }

  const living = pets.filter((pet) => pet.lifeStatus === "living");
  const memorial = pets.filter((pet) => pet.lifeStatus === "memorial");
  if (living.length > 0 && memorial.length === 0) {
    return entryHomePath("living", living.length === 1 ? living[0].petId : null);
  }
  if (memorial.length > 0 && living.length === 0) {
    return entryHomePath("memorial", memorial.length === 1 ? memorial[0].petId : null);
  }
  return "/choose";
}

/** A confirmed pet status moves the open home. Unspecified stays on the home the user opened. */
export function redirectForSelectedPet(
  branch: EntryBranch,
  pet: BranchPetRef | null | undefined,
): string | null {
  if (!pet) return null;
  if (pet.lifeStatus === "living" && branch !== "living") return entryHomePath("living", pet.petId);
  if (pet.lifeStatus === "memorial" && branch !== "memorial") return entryHomePath("memorial", pet.petId);
  return null;
}

export function petsOnBranch<T extends BranchPetRef>(
  pets: T[],
  branch: EntryBranch,
  selectedPetId?: string | null,
): T[] {
  return pets.filter(
    (pet) => pet.lifeStatus === branch || (pet.petId === selectedPetId && pet.lifeStatus === "unspecified"),
  );
}

export function petsOnOtherBranch<T extends BranchPetRef>(pets: T[], branch: EntryBranch): T[] {
  const other: EntryBranch = branch === "living" ? "memorial" : "living";
  return pets.filter((pet) => pet.lifeStatus === other);
}
