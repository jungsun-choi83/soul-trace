import type { ServerSearchParams } from "@/lib/search-params";
import { redirect } from "next/navigation";

function petQuery(params: ServerSearchParams) {
  const raw = params.pet;
  const pet = Array.isArray(raw) ? raw[0] : raw;
  return pet ? `?pet=${encodeURIComponent(pet)}` : "";
}

export default async function DeviceFaceAlias({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  redirect(`/my/collar/face${petQuery(await searchParams)}`);
}
