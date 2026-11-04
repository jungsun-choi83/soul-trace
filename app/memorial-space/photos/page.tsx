import type { ServerSearchParams } from "@/lib/search-params";
import { isUuid } from "@/lib/pet-first-archive";
import { redirect } from "next/navigation";

export default async function MemorialPhotosAlias({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const raw = params.pet;
  const pet = Array.isArray(raw) ? raw[0] : raw;
  redirect(pet && isUuid(pet) ? `/memorial-space?pet=${encodeURIComponent(pet)}` : "/memorial-space");
}
