import type { ServerSearchParams } from "@/lib/search-params";
import { redirect } from "next/navigation";

export default async function BeamPreviewAlias({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["pet", "entry", "asset"] as const) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  redirect(suffix ? `/beam-scene?${suffix}` : "/beam-scene");
}
