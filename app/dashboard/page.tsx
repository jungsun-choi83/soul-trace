import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { dashboardHomePath } from "@/lib/entry-branch";
import { loadEntryHome } from "@/lib/load-entry-home";
import { isPetFirstArchiveEnabled, isUuid } from "@/lib/pet-first-archive";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "홈",
  description: "선택한 반려동물의 상태로 홈을 엽니다.",
  robots: noIndexRobots,
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  if (!isPetFirstArchiveEnabled()) notFound();
  const params = await searchParams;
  const rawPet = params.pet;
  const requested = Array.isArray(rawPet) ? rawPet[0] : rawPet;
  const selectedPetId = requested && isUuid(requested) ? requested : null;
  const home = await loadEntryHome();
  if (!home.signedIn) redirect("/choose");
  redirect(dashboardHomePath(home.pets, selectedPetId));
}
