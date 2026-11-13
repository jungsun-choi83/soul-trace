import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PetProfileForm } from "@/components/pet-profile-form";
import { StorybookShell } from "@/components/pet-form-shell";
import { isPetFirstArchiveEnabled, type LifeStatus } from "@/lib/pet-first-archive";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "우리 아이 등록",
  robots: noIndexRobots,
};

export default async function NewPetPage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  if (!isPetFirstArchiveEnabled()) notFound();
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const rawContinueTo = Array.isArray(params.continueTo) ? params.continueTo[0] : params.continueTo;
  const lifeStatus: LifeStatus = raw === "living" || raw === "memorial" ? raw : "unspecified";

  return (
    <StorybookShell backHref="/dashboard" titleKey="createPet">
      <PetProfileForm
        mode="create"
        continueTo={rawContinueTo ?? null}
        initial={{ petName: "", lifeStatus, species: null, birthday: null, adoptedOn: null, traits: null }}
      />
    </StorybookShell>
  );
}
