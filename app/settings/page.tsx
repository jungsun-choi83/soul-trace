import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountSettings } from "@/components/account-settings";
import { authEntryPath } from "@/lib/auth-redirect";
import { isPetFirstArchiveEnabled } from "@/lib/pet-first-archive";
import { loadPetHome } from "@/lib/pet-first-archive-data";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "설정",
  robots: noIndexRobots,
};

export default async function SettingsPage() {
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(authEntryPath("/settings"));

  const petId = isPetFirstArchiveEnabled()
    ? (await loadPetHome(supabase, user.id))?.pets[0]?.petId ?? null
    : null;

  return <AccountSettings email={user.email ?? null} petId={petId} />;
}
