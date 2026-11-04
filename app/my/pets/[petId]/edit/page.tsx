import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PetProfileForm } from "@/components/pet-profile-form";
import { StorybookShell } from "@/components/pet-form-shell";
import { authEntryPath } from "@/lib/auth-redirect";
import { isPetFirstArchiveEnabled, isUuid } from "@/lib/pet-first-archive";
import { loadPetProfile } from "@/lib/pet-first-archive-data";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "프로필 수정",
  robots: noIndexRobots,
};

export default async function EditPetPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  if (!isPetFirstArchiveEnabled()) notFound();
  const { petId } = await params;
  if (!isUuid(petId)) notFound();
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(authEntryPath(`/my/pets/${petId}/edit`));

  const result = await loadPetProfile(supabase, user.id, petId);
  if (result.status === "unavailable") notFound();
  if (result.status === "not_found") notFound();

  return (
    <StorybookShell backHref={`/dashboard?pet=${petId}`} titleKey="editPet" petId={petId} lifeStatus={result.profile.lifeStatus}>
      <PetProfileForm
        mode="edit"
        petId={result.profile.petId}
        initial={{
          petName: result.profile.petName,
          lifeStatus: result.profile.lifeStatus,
          species: result.profile.species,
          birthday: result.profile.birthday,
          adoptedOn: result.profile.adoptedOn,
          traits: result.profile.traits,
        }}
      />
    </StorybookShell>
  );
}
