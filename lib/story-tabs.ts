import { memoriesHref } from "./memory-library.ts";
import type { LifeStatus } from "@/lib/pet-first-archive";
import type { PetFirstCopy } from "@/lib/storybook-copy";

export type StoryTab = "home" | "memories" | "create" | "pet";

export function storyTabHrefs(
  petId: string | null,
  signedIn = false,
  lifeStatus: LifeStatus | null = null,
) {
  const status = lifeStatus ?? "unspecified";
  const petQuery = petId ? `?pet=${encodeURIComponent(petId)}` : "";
  const createQuery = new URLSearchParams();
  if (petId) createQuery.set("pet", petId);
  if (status === "living" || status === "memorial") createQuery.set("branch", status);
  return {
    home:
      status === "memorial"
        ? `/dashboard/memorial${petQuery}`
        : status === "living"
          ? `/dashboard/living${petQuery}`
          : signedIn
            ? "/dashboard"
            : "/choose",
    memories: signedIn
      ? petId
        ? `/my/pets/${encodeURIComponent(petId)}/memories#album`
        : "/my/pets"
      : memoriesHref(petId),
    create: createQuery.size ? `/create?${createQuery.toString()}` : "/create",
    pet: "/my/pets",
  };
}

export function storyTabLabels(
  copy: Pick<PetFirstCopy, "tabs">,
  _lifeStatus: LifeStatus | null = null,
): Record<StoryTab, string> {
  return {
    home: copy.tabs.home,
    memories: copy.tabs.memories,
    create: copy.tabs.create,
    pet: copy.tabs.pet,
  };
}

export function storyTabProps(
  copy: Pick<PetFirstCopy, "tabs">,
  petId: string | null,
  signedIn = false,
  lifeStatus: LifeStatus | null = null,
) {
  return {
    labels: storyTabLabels(copy, lifeStatus),
    hrefs: storyTabHrefs(petId, signedIn, lifeStatus),
    lifeStatus: (lifeStatus ?? "unspecified") as LifeStatus,
  };
}
