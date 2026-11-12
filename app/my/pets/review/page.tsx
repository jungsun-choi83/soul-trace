import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PetFirstUnavailable } from "@/components/pet-first-unavailable";
import { PetReviewRoster } from "@/components/pet-review-roster";
import { authEntryPath } from "@/lib/auth-redirect";
import { isPetFirstArchiveEnabled } from "@/lib/pet-first-archive";
import { loadPetHome } from "@/lib/pet-first-archive-data";
import { ensureOwnerRow } from "@/lib/pet-first-archive-server";
import { loadPetRosterForUser } from "@/lib/pet-roster-loader";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Review pet profiles | Soul Trace",
  robots: noIndexRobots,
};

export default async function PetReviewPage() {
  if (!isPetFirstArchiveEnabled()) redirect("/my/pets");
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(authEntryPath("/my/pets/review"));

  const roster = await loadPetRosterForUser(
    user.id,
    async (userId) => (await ensureOwnerRow(supabase, userId)) === null,
    (userId) => loadPetHome(supabase, userId),
  );
  if (roster.status === "unavailable") return <PetFirstUnavailable />;
  return <PetReviewRoster pets={roster.pets} />;
}
