import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PetRoster } from "@/components/pet-roster";
import { PetFirstUnavailable } from "@/components/pet-first-unavailable";
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
  title: "내 아이",
  description: "우리 아이 프로필과 상태를 관리합니다.",
  robots: noIndexRobots,
};

export default async function MyPetsPage() {
  if (!isPetFirstArchiveEnabled()) notFound();
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(authEntryPath("/my/pets"));

  const roster = await loadPetRosterForUser(
    user.id,
    async (userId) => (await ensureOwnerRow(supabase, userId)) === null,
    (userId) => loadPetHome(supabase, userId),
  );
  if (roster.status === "unavailable") return <PetFirstUnavailable />;
  return <PetRoster pets={roster.pets} />;
}
