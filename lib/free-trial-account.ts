import type { FreeStyle } from "./pet-free-trial.ts";
import { freeTrialResultObjectKey } from "./free-trial-persistence-contract.ts";

export type FreeTrialAccountResult = {
  resultId: string;
  petId: string;
  style: FreeStyle;
  theme: string;
  createdAt: string;
};

type StoredFreeTrialRow = {
  result_id?: unknown;
  pet_id?: unknown;
  owner_user_id?: unknown;
  style?: unknown;
  theme?: unknown;
  created_at?: unknown;
};

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isStyle(value: unknown): value is FreeStyle {
  return value === "felt-doll" || value === "gouache-story" || value === "crayon-diary";
}

export async function listOwnedFreeTrialResults(
  ownerId: string,
  loadRows: (verifiedOwnerId: string) => Promise<{ rows: unknown; error: boolean }>,
): Promise<{ status: "ok"; results: FreeTrialAccountResult[] } | { status: "unavailable" }> {
  if (!isUuid(ownerId)) return { status: "unavailable" };
  let loaded: { rows: unknown; error: boolean };
  try {
    loaded = await loadRows(ownerId);
  } catch {
    return { status: "unavailable" };
  }
  if (loaded.error || !Array.isArray(loaded.rows)) return { status: "unavailable" };
  const results = loaded.rows.flatMap((raw): FreeTrialAccountResult[] => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as StoredFreeTrialRow;
    if (row.owner_user_id !== ownerId || !isUuid(row.result_id) || !isUuid(row.pet_id)
      || !isStyle(row.style) || typeof row.theme !== "string"
      || !/^[a-z0-9-]{1,48}$/.test(row.theme)
      || typeof row.created_at !== "string") return [];
    return [{
      resultId: row.result_id,
      petId: row.pet_id,
      style: row.style,
      theme: row.theme,
      createdAt: row.created_at,
    }];
  });
  return { status: "ok", results };
}

export async function claimFreeTrialSession(
  guestHash: string | null,
  ownerId: string,
  claim: (verifiedGuestHash: string, verifiedOwnerId: string) => Promise<boolean>,
): Promise<boolean> {
  if (!guestHash || !/^[a-f0-9]{64}$/.test(guestHash) || !isUuid(ownerId)) return false;
  try {
    return await claim(guestHash, ownerId);
  } catch {
    return false;
  }
}

export async function fetchAuthorizedFreeTrialResult(
  args: { resultId: string; guestHash: string | null; ownerId: string | null },
  authorize: (args: { resultId: string; guestHash: string | null; ownerId: string | null }) => Promise<string | null>,
  download: (objectKey: string) => Promise<Blob | null>,
): Promise<Blob | null> {
  const objectKey = freeTrialResultObjectKey(args.resultId);
  if (!objectKey || (!args.guestHash && !args.ownerId)) return null;
  try {
    const authorizedKey = await authorize(args);
    if (authorizedKey !== objectKey) return null;
    return await download(objectKey);
  } catch {
    return null;
  }
}
