export type FreeTrialActor = { userId: string | null; guestHash: string | null };
export type FreeTrialResultOwner = { ownerUserId: string | null; guestSessionHash: string | null };
export type FreeTrialClaimRecord = { ownerUserId: string; expiresAt: number };

export type FreeTrialClaimDecision = "claim" | "already_claimed" | "expired" | "owned_by_other" | "missing";

export function freeTrialResultObjectKey(resultId: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resultId)) return null;
  return "free-trial/" + resultId.toLowerCase() + ".jpg";
}

export function canReadFreeTrialResult(result: FreeTrialResultOwner, actor: FreeTrialActor): boolean {
  if (actor.userId && result.ownerUserId === actor.userId) return true;
  return !!actor.guestHash && result.guestSessionHash === actor.guestHash && result.ownerUserId === null;
}

export function decideFreeTrialClaim(args: {
  claim: FreeTrialClaimRecord | null;
  hasGuestRecords: boolean;
  userId: string;
  now: number;
}): FreeTrialClaimDecision {
  if (args.claim) {
    if (args.claim.expiresAt <= args.now) return "expired";
    return args.claim.ownerUserId === args.userId ? "already_claimed" : "owned_by_other";
  }
  return args.hasGuestRecords ? "claim" : "missing";
}

export function freeTrialRetryOutcome(args: {
  status: "reserved" | "failed" | "succeeded";
  samePet: boolean;
  sameRequest: boolean;
}): "in_progress" | "retry" | "replay" | "conflict" {
  if (!args.samePet || !args.sameRequest) return "conflict";
  if (args.status === "reserved") return "in_progress";
  if (args.status === "succeeded") return "replay";
  return "retry";
}

export function failedFreeTrialAllowance(status: "available" | "reserved" | "consumed"): "available" | "reserved" | "consumed" {
  return status === "reserved" ? "available" : status;
}
