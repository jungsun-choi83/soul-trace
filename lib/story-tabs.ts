import type { LifeStatus } from "@/lib/pet-first-archive";
import type { PetFirstCopy } from "@/lib/storybook-copy";

export type StoryTab = "home" | "memories" | "create" | "context" | "pet";

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
    memories: petId ? `/my/pets/${petId}` : "/life-archive",
    create: createQuery.size ? `/create?${createQuery.toString()}` : "/create",
    context:
      status === "memorial"
        ? `/memorial-space${petQuery}`
        : `/my/device${petQuery}`,
    pet: "/my/pets",
  };
}

export function storyTabLabels(
  copy: Pick<PetFirstCopy, "tabs">,
  lifeStatus: LifeStatus | null = null,
): Record<StoryTab, string> {
  const status = lifeStatus ?? "unspecified";
  return {
    home: copy.tabs.home,
    memories: copy.tabs.memories,
    create: copy.tabs.create,
    context: status === "memorial" ? copy.tabs.memorialHall : copy.tabs.collar,
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
