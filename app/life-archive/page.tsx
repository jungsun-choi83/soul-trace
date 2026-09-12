import { LifeArchivePreview } from "@/components/life-archive-preview";
import { TemporaryLifeArchiveLoader } from "@/components/temporary-life-archive-loader";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ACTIVE_SUBMISSION_COOKIE } from "@/lib/life-archive-session";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import type { ServerSearchParams } from "@/lib/search-params";
import { resolveLifeArchiveNavigation } from "@/lib/life-archive-navigation";

export const metadata: Metadata = {
  title: "Life Archive | Soul Trace",
  description: "A visual preview of the future Soul Trace Life Archive.",
};

export default async function LifeArchivePage({ searchParams }: { searchParams: Promise<ServerSearchParams> }) {
  const params = await searchParams;
  const navigation = resolveLifeArchiveNavigation(params);
  const previewNavigation = {
    navigationOrigin: navigation.origin,
    backHref: navigation.backHref,
    archiveQuery: navigation.archiveQuery,
  };
  const secureLifeArchiveEnabled = process.env.NEXT_PUBLIC_LIFE_ARCHIVE_SECURE_MODE === "1";
  const supabase = secureLifeArchiveEnabled
    ? await createSupabaseAuthServerClient()
    : null;
  if (!supabase) return <TemporaryLifeArchiveLoader {...previewNavigation} />;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return <LifeArchivePreview status="authentication-required" {...previewNavigation} />;

  const requestedPetId = typeof params.pet === "string" ? params.pet : null;
  const requestedSubmissionId = typeof params.letter === "string" ? params.letter : null;
  const cookieStore = await cookies();
  const preferredSubmissionId = requestedSubmissionId ?? cookieStore.get(ACTIVE_SUBMISSION_COOKIE)?.value ?? null;

  const [petsResult, submissionsResult] = await Promise.all([
    supabase.from("soul_trace_pets").select("pet_id, pet_name, created_at")
      .eq("owner_user_id", userData.user.id).order("created_at", { ascending: false }),
    supabase
    .from("soul_trace_submissions")
    .select(
      "submission_id, pet_id, letter_id, generated_letter, letter_title, letter_mode, service_channel, generation_locale, created_at",
    )
    .eq("owner_user_id", userData.user.id)
    .order("created_at", { ascending: false }),
  ]);

  if (petsResult.error || submissionsResult.error) return <LifeArchivePreview status="error" {...previewNavigation} />;
  const pets = petsResult.data ?? [];
  const submissions = submissionsResult.data ?? [];
  if (!pets.length || !submissions.length) return <LifeArchivePreview status="selection-required" {...previewNavigation} />;

  const preferredSubmission = submissions.find((item) => item.submission_id === preferredSubmissionId);
  const selectedPetId = requestedPetId && pets.some((pet) => pet.pet_id === requestedPetId)
    ? requestedPetId
    : preferredSubmission?.pet_id ?? pets.find((pet) => submissions.some((item) => item.pet_id === pet.pet_id))?.pet_id;
  const petSubmissions = submissions.filter((item) => item.pet_id === selectedPetId);
  const submission = petSubmissions.find((item) => item.submission_id === requestedSubmissionId)
    ?? petSubmissions.find((item) => item.submission_id === preferredSubmissionId)
    ?? petSubmissions[0];

  if (!submission) return <LifeArchivePreview status="selection-required" {...previewNavigation} />;

  const [petResult, answerResult, memoryResult] = await Promise.all([
    supabase
      .from("soul_trace_pets")
      .select("pet_name")
      .eq("pet_id", submission.pet_id)
      .eq("owner_user_id", userData.user.id)
      .maybeSingle(),
    supabase
      .from("soul_trace_submission_answers")
      .select("answer_id", { count: "exact", head: true })
      .eq("submission_id", submission.submission_id)
      .lte("answer_order", 5),
    supabase
      .from("life_archive_memories")
      .select("memory_id, title, story, memory_date, created_at")
      .eq("submission_id", submission.submission_id)
      .eq("owner_user_id", userData.user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (
    petResult.error ||
    !petResult.data ||
    answerResult.error ||
    memoryResult.error
  ) {
    return <LifeArchivePreview status="error" {...previewNavigation} />;
  }

  return (
    <LifeArchivePreview
      status="ready"
      archive={{
        archiveKey: submission.submission_id,
        petName: petResult.data.pet_name,
        letter: submission.generated_letter,
        generationLocale: submission.generation_locale === "ko" ? "ko" : "en",
        createdAt: submission.created_at,
        soulTraceMemoryCount: answerResult.count ?? 0,
        archiveMemoryCount: memoryResult.data?.length ?? 0,
        memories: (memoryResult.data ?? []).map((memory) => ({
          memoryId: memory.memory_id,
          title: memory.title,
          story: memory.story,
          memoryDate: memory.memory_date,
          createdAt: memory.created_at,
        })),
      }}
      accountPets={pets.map((pet) => ({
        petId: pet.pet_id,
        petName: pet.pet_name,
        letters: submissions.filter((item) => item.pet_id === pet.pet_id).map((item) => ({
          submissionId: item.submission_id,
          letterId: item.letter_id,
          title: item.letter_title,
          mode: item.letter_mode,
          channel: item.service_channel,
          locale: item.generation_locale === "ko" ? "ko" as const : "en" as const,
          createdAt: item.created_at,
        })),
      }))}
      selectedPetId={selectedPetId}
      selectedSubmissionId={submission.submission_id}
      {...previewNavigation}
    />
  );
}
