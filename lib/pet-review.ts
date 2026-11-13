import type { HomePet } from "./pet-first-archive-data.ts";

export function splitCurrentAndUnclassifiedPets(pets: HomePet[]) {
  return {
    current: pets.filter((pet) => pet.lifeStatus === "living" || pet.lifeStatus === "memorial"),
    unclassified: pets.filter((pet) => pet.lifeStatus === "unspecified"),
  };
}
