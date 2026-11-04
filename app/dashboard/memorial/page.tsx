import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { MemorialHome } from "@/components/memorial-home";
import { redirectForSelectedPet } from "@/lib/entry-branch";
import { loadEntryHome } from "@/lib/load-entry-home";
import { isPetFirstArchiveEnabled, isUuid } from "@/lib/pet-first-archive";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "우리 아이와 함께했던 소중한 순간들",
  description: "구름 위에 있는 아이의 추억, 편지, 폴라로이드, 추모관 홈입니다.",
  robots: noIndexRobots,
};

export default async function MemorialDashboardPage({
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
  const selected = home.pets.find((pet) => pet.petId === selectedPetId) ?? null;
  const jump = redirectForSelectedPet("memorial", selected);
  if (jump) redirect(jump);

  return (
    <MemorialHome
      signedIn={home.signedIn}
      pets={home.pets}
      recent={home.recent}
      selectedPetId={selected?.petId ?? null}
    />
  );
}
