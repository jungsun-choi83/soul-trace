import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollarStudioRoute } from "@/components/collar-studio";
import { collarStudioPet } from "@/lib/collar-route-pet";
import { isPetFirstArchiveEnabled } from "@/lib/pet-first-archive";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "목걸이 화면 설정",
  robots: noIndexRobots,
};

export default async function CollarInfoPage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  if (!isPetFirstArchiveEnabled()) notFound();
  const pet = await collarStudioPet(await searchParams);
  return <CollarStudioRoute step="info" pet={pet} />;
}
