import type { ServerSearchParams } from "@/lib/search-params";
import { redirect } from "next/navigation";

export default async function DeviceLayoutAlias({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const raw = params.pet;
  const pet = Array.isArray(raw) ? raw[0] : raw;
  redirect(pet ? `/my/collar/info?pet=${encodeURIComponent(pet)}` : "/my/collar/info");
}
