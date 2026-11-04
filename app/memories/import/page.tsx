import { isUuid } from "@/lib/pet-first-archive";
import type { ServerSearchParams } from "@/lib/search-params";
import { redirect } from "next/navigation";

export default async function MemoryImportAlias({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  redirect(await memoryTarget(await searchParams, "compose"));
}

async function memoryTarget(params: ServerSearchParams, hash: string) {
  const raw = params.pet;
  const pet = Array.isArray(raw) ? raw[0] : raw;
  return pet && isUuid(pet) ? `/my/pets/${pet}#${hash}` : "/life-archive";
}
