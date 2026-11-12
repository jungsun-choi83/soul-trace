import { redirect } from "next/navigation";
import { freeTrialSaveDestination } from "@/lib/free-trial-onboarding";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export default async function SaveTrialPage() {
  const auth = await createSupabaseAuthServerClient();
  const user = auth ? (await auth.auth.getUser()).data.user : null;
  redirect(freeTrialSaveDestination(Boolean(auth && user)));
}
