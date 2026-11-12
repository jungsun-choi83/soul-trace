import { trialLedger } from "@/lib/pet-free-trial";
import { requirePetFirstUser } from "@/lib/pet-first-archive-server";
import { isUuid } from "@/lib/pet-first-archive";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "st_guest_trial";

export default async function SaveTrialPage() {
  const access = await requirePetFirstUser();
  if (access.ok) {
    const guest = (await cookies()).get(COOKIE)?.value;
    if (guest && isUuid(guest)) trialLedger().claim(guest, access.user.id);
  }
  redirect("/dashboard/living");
}
