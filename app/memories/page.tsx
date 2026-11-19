import { MemoriesArchive, type MemoriesPet } from "@/components/memories-archive";
import { isPetFirstArchiveEnabled, isUuid } from "@/lib/pet-first-archive";
import { loadPetHome } from "@/lib/pet-first-archive-data";
import type { ServerSearchParams } from "@/lib/search-params";
import { noIndexRobots } from "@/lib/site-url";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "우리아이의 여정",
  description: "반려동물의 사진, 영상, 폴라로이드, 편지를 모아 봅니다.",
  robots: noIndexRobots,
};

export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const raw = params.pet;
  const requested = Array.isArray(raw) ? raw[0] : raw ?? null;
  const requestedPetId = requested && isUuid(requested) ? requested : null;
  const viewRaw = params.view;
  const view = (Array.isArray(viewRaw) ? viewRaw[0] : viewRaw) === "months" ? "months" : "archive";
  const monthRaw = params.month;
  const monthValue = Array.isArray(monthRaw) ? monthRaw[0] : monthRaw;
  const month = monthValue && /^\d{4}-\d{2}$/.test(monthValue) ? monthValue : null;
  const categoryRaw = params.category;
  const categoryValue = Array.isArray(categoryRaw) ? categoryRaw[0] : categoryRaw;
  const category = categoryValue === "photo" || categoryValue === "video" || categoryValue === "polaroid" || categoryValue === "letter" ? categoryValue : null;
  const branchRaw = params.branch;
  const branchValue = Array.isArray(branchRaw) ? branchRaw[0] : branchRaw;
  const branch = branchValue === "memorial" || branchValue === "living" ? branchValue : null;
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) {
    return <MemoriesArchive access="guest" pets={[]} selectedPetId={requestedPetId} view={view} month={month} category={category} branch={branch} />;
  }
  if (!isPetFirstArchiveEnabled()) {
    return <MemoriesArchive access="unavailable" pets={[]} selectedPetId={null} view={view} month={month} category={category} branch={branch} />;
  }

  const home = await loadPetHome(supabase, user.id);
  if (!home) return <MemoriesArchive access="unavailable" pets={[]} selectedPetId={null} view={view} month={month} category={category} branch={branch} />;

  const pets: MemoriesPet[] = home.pets.map((pet) => ({
    petId: pet.petId,
    petName: pet.petName,
    lifeStatus: pet.lifeStatus,
    species: pet.species,
    avatarUrl: pet.avatarUrl,
  }));
  const selected = pets.find((pet) => pet.petId === requestedPetId)
    ?? (branch === "memorial"
      ? pets.find((pet) => pet.lifeStatus === "memorial") ?? null
      : pets[0] ?? null);
  return <MemoriesArchive access="owner" pets={pets} selectedPetId={selected?.petId ?? null} view={view} month={month} category={category} branch={branch} />;
}
