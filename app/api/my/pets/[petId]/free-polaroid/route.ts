import { trialLedger } from "@/lib/pet-free-trial";
import { privateJson, requireOwnedPet } from "@/lib/pet-first-archive-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;
  const remaining = trialLedger().attachOwnedPet({
    petId: access.pet.pet_id,
    userId: access.user.id,
    name: access.pet.pet_name,
    now: Date.now(),
    enforceCap: false,
  });
  return privateJson({ remaining }, 200);
}
