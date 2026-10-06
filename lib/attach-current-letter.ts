export type LetterAttachmentDecision = "missing" | "forbidden" | "already_saved" | "claim";

export function letterAttachmentDecision(
  ownerUserId: string | null,
  userId: string,
): Exclude<LetterAttachmentDecision, "missing"> {
  if (ownerUserId === userId) return "already_saved";
  if (ownerUserId) return "forbidden";
  return "claim";
}
