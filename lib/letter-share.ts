import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { splitBodyParagraphs } from "@/lib/generated-letter";
import { HERO_BUCKET } from "@/lib/hero-image-store";
import { resolveLetterLanguage } from "@/lib/letter-language";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHARE_TTL_DAYS = 90;

export type SharedLetter = {
  title: string;
  letter: string;
  endingPhrase: string;
  paragraphs: string[];
  petName: string;
  mode: "living" | "memorial";
  locale: "en" | "ko";
  heroImageUrl: string | null;
  createdAt: string | null;
};

export function isLetterShareToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export function createLetterShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLetterShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function letterShareExpiry(): string {
  return new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function loadSharedLetter(token: string): Promise<SharedLetter | null> {
  if (!isLetterShareToken(token)) return null;
  const db = createSupabaseServerClient();
  if (!db) return null;

  const { data: share, error: shareError } = await db
    .from("letter_shares")
    .select("letter_id, expires_at, revoked_at")
    .eq("token_hash", hashLetterShareToken(token))
    .maybeSingle();
  if (shareError || !share?.letter_id || share.revoked_at) return null;
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) return null;

  const { data: submission, error: submissionError } = await db
    .from("soul_trace_submissions")
    .select("letter_id, generated_letter, letter_title, letter_ending_phrase, letter_mode, generation_locale, pet_id, created_at, hero_image_url, hero_image_ref")
    .eq("letter_id", share.letter_id)
    .maybeSingle();
  if (submissionError || !submission?.generated_letter || !submission.pet_id) return null;

  const { data: pet, error: petError } = await db
    .from("soul_trace_pets")
    .select("pet_name")
    .eq("pet_id", submission.pet_id)
    .maybeSingle();
  if (petError || !pet?.pet_name) return null;

  const locale = resolveLetterLanguage(submission.generation_locale);
  const endingPhrase = typeof submission.letter_ending_phrase === "string"
    ? submission.letter_ending_phrase.trim()
    : "";
  const paragraphs = splitBodyParagraphs(submission.generated_letter);
  if (endingPhrase && paragraphs.at(-1)?.trim() === endingPhrase) paragraphs.pop();

  let heroImageUrl = typeof submission.hero_image_url === "string" ? submission.hero_image_url : null;
  if (typeof submission.hero_image_ref === "string" && submission.hero_image_ref.trim()) {
    const { data: signed } = await db.storage
      .from(HERO_BUCKET)
      .createSignedUrl(submission.hero_image_ref, 60 * 60);
    heroImageUrl = signed?.signedUrl ?? heroImageUrl;
  }

  return {
    title: typeof submission.letter_title === "string" && submission.letter_title.trim()
      ? submission.letter_title.trim()
      : locale === "ko" ? `${pet.pet_name}가 보내는 편지` : `A letter from ${pet.pet_name}`,
    letter: submission.generated_letter,
    endingPhrase,
    paragraphs,
    petName: pet.pet_name,
    mode: submission.letter_mode === "memorial" ? "memorial" : "living",
    locale,
    heroImageUrl,
    createdAt: typeof submission.created_at === "string" ? submission.created_at : null,
  };
}
