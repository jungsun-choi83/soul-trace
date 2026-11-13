export type LetterPetAccessInput = {
  userId: string | null;
  verifiedLegacyLinkMatches: boolean;
  linkedPetOwnerId: string | null;
  hasConflictingSubmissionOwner: boolean;
  requestedPetId: string;
};

export type LetterPetAccessResult =
  | { allowed: true; source: "pet-first" | "verified-legacy" }
  | { allowed: false };

/**
 * A selected pet is usable only when directly owned by the authenticated user,
 * or when a verified account email matches its historical legacy link and the
 * pet is not assigned to a different account.
 */
export function decideLetterPetAccess(input: LetterPetAccessInput & {
  ownedPetId: string | null;
}): LetterPetAccessResult {
  if (input.userId && input.ownedPetId === input.requestedPetId) {
    return { allowed: true, source: "pet-first" };
  }
  if (
    input.userId &&
    input.verifiedLegacyLinkMatches &&
    (input.linkedPetOwnerId === null || input.linkedPetOwnerId === input.userId) &&
    !input.hasConflictingSubmissionOwner
  ) {
    return { allowed: true, source: "verified-legacy" };
  }
  return { allowed: false };
}

export function letterMatchesSelectedPet(
  linkedLetterPetId: string | null,
  requestedPetId: string | null,
): boolean {
  return !requestedPetId || linkedLetterPetId === requestedPetId;
}
