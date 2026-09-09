import "server-only";

import type { GeneratedResult } from "@/components/soul-trace-flow";
import {
  createGeneratedLetterStructure,
  splitBodyParagraphs,
} from "@/lib/generated-letter";
import { HERO_BUCKET } from "@/lib/hero-image-store";
import { ACTIVE_SUBMISSION_COOKIE } from "@/lib/life-archive-session";
import type { LetterMode } from "@/lib/letter-mode";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";

export type PersistentLetterResult = {
  mode: LetterMode;
  result: GeneratedResult;
};

export async function loadPersistentLetterResult(): Promise<PersistentLetterResult | null> {
  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return null;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const cookieStore = await cookies();
  const submissionId = cookieStore.get(ACTIVE_SUBMISSION_COOKIE)?.value;
  if (!submissionId) return null;

  const { data: submission, error } = await supabase
    .from("soul_trace_submissions")
    .select(
      "submission_id, pet_id, letter_id, generated_letter, letter_title, letter_ending_phrase, letter_mode, personality_type, generation_locale, hero_image_url, hero_image_ref",
    )
    .eq("submission_id", submissionId)
    .eq("owner_user_id", userData.user.id)
    .maybeSingle();
  if (error || !submission) return null;

  const { data: pet } = await supabase
    .from("soul_trace_pets")
    .select("pet_name")
    .eq("pet_id", submission.pet_id)
    .eq("owner_user_id", userData.user.id)
    .maybeSingle();
  if (!pet) return null;

  const generationLocale = submission.generation_locale === "ko" ? "ko" : "en";
  const mode: LetterMode = submission.letter_mode === "memorial" ? "memorial" : "living";
  const endingPhrase = submission.letter_ending_phrase?.trim() ?? "";
  const paragraphs = splitBodyParagraphs(submission.generated_letter);
  if (endingPhrase && paragraphs.at(-1)?.trim() === endingPhrase) paragraphs.pop();

  const fallbackTitle = generationLocale === "ko"
    ? `${pet.pet_name}가 보내는 편지`
    : `A letter from ${pet.pet_name}`;
  const letterStructure = createGeneratedLetterStructure(
    submission.letter_title?.trim() || fallbackTitle,
    paragraphs.join("\n\n"),
    endingPhrase,
    generationLocale,
  );

  let heroImageUrl = submission.hero_image_url as string | null;
  if (submission.hero_image_ref) {
    const admin = createSupabaseServerClient();
    if (admin) {
      const { data } = await admin.storage
        .from(HERO_BUCKET)
        .createSignedUrl(submission.hero_image_ref, 60 * 60);
      heroImageUrl = data?.signedUrl ?? heroImageUrl;
    }
  }

  return {
    mode,
    result: {
      personalityType: submission.personality_type,
      personalitySummary: "",
      personalityTags: [],
      letter: submission.generated_letter,
      letterStructure,
      heroImageUrl,
      heroImageSkipped: !heroImageUrl,
      savedPetName: pet.pet_name,
      letterId: submission.letter_id,
      persistenceFailed: false,
      generationLocale,
    },
  };
}
