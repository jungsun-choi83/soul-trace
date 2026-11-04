import { isUuid } from "@/lib/pet-first-archive";
import type { ServerSearchParams } from "@/lib/search-params";
import { redirect } from "next/navigation";

export default async function MemoryReviewAlias({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const raw = params.pet;
  const pet = Array.isArray(raw) ? raw[0] : raw;
  redirect(pet && isUuid(pet) ? `/memories?pet=${encodeURIComponent(pet)}#months` : "/memories");
}
