import { createHmac, timingSafeEqual } from "node:crypto";

export type ResultSaveKind = "letter" | "visual-memory";

const RESULT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isResultSaveId(value: string): boolean {
  return RESULT_ID_PATTERN.test(value);
}

export function createResultSaveProof(
  kind: ResultSaveKind,
  resultId: string,
  secret: string,
): string | null {
  if (!secret.trim() || !isResultSaveId(resultId)) return null;
  return createHmac("sha256", secret).update(`${kind}:${resultId}`).digest("base64url");
}

export function resultSaveProofMatches(
  kind: ResultSaveKind,
  resultId: string,
  proof: string,
  secret: string,
): boolean {
  const expected = createResultSaveProof(kind, resultId, secret);
  if (!expected || !proof) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(proof);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function resultSaveSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}
