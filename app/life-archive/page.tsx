import { LifeArchivePreview } from "@/components/life-archive-preview";
import { TemporaryLifeArchiveLoader } from "@/components/temporary-life-archive-loader";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ACTIVE_SUBMISSION_COOKIE } from "@/lib/life-archive-session";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const metadata: Metadata = {
  title: "Life Archive | Soul Trace",
  description: "A visual preview of the future Soul Trace Life Archive.",
};

export default async function LifeArchivePage() {
  const secureLifeArchiveEnabled = process.env.NEXT_PUBLIC_LIFE_ARCHIVE_SECURE_MODE === "1";
  const supabase = secureLifeArchiveEnabled
    ? await createSupabaseAuthServerClient()
    : null;
  if (!supabase) return <TemporaryLifeArchiveLoader />;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return <LifeArchivePreview status="authentication-required" />;

  const cookieStore = await cookies();
  const submissionId = cookieStore.get(ACTIVE_SUBMISSION_COOKIE)?.value;
  if (!submissionId) return <LifeArchivePreview status="selection-required" />;

  const { data: submission, error } = await supabase
    .from("soul_trace_submissions")
    .select(
      "submission_id, pet_id, letter_id, generated_letter, generation_locale, created_at",
    )
    .eq("submission_id", submissionId)
    .eq("owner_user_id", userData.user.id)
    .maybeSingle();

  if (error || !submission) return <LifeArchivePreview status="error" />;

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
    return <LifeArchivePreview status="error" />;
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
    />
  );
}
