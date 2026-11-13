import type { HomePet, HomeRecent } from "./pet-first-archive-data.ts";

export type PetRosterLoadResult =
  | { status: "ready"; pets: HomePet[] }
  | { status: "unavailable" };

export async function loadPetRosterForUser(
  userId: string,
  ensureOwner: (userId: string) => Promise<boolean>,
  loadHome: (userId: string) => Promise<{ pets: HomePet[]; recent: HomeRecent[] } | null>,
): Promise<PetRosterLoadResult> {
  if (!(await ensureOwner(userId))) return { status: "unavailable" };
  const home = await loadHome(userId);
  return home ? { status: "ready", pets: home.pets } : { status: "unavailable" };
}
