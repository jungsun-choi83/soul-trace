import "server-only";

export type RedeemedEternalBeamAccess = { ebUserId: string; orderId: string };

export async function redeemEternalBeamAccess(handoff: string): Promise<RedeemedEternalBeamAccess> {
  const base = process.env.ETERNAL_BEAM_API_BASE?.trim().replace(/\/$/, "");
  const serviceToken = process.env.SOUL_TRACE_SERVICE_TOKEN?.trim();
  if (!base || !serviceToken) throw new Error("Eternal Beam redemption is not configured.");
  const response = await fetch(`${base}/api/v1/soul-trace/access/internal/redeem`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-EB-Service-Token": serviceToken },
    body: JSON.stringify({ handoff }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Eternal Beam access was not verified.");
  const body = await response.json() as Partial<{
    eligible: boolean; ebUserId: string; orderId: string; scope: string;
  }>;
  if (body.eligible !== true || body.scope !== "life_archive" || !body.ebUserId || !body.orderId) {
    throw new Error("Eternal Beam returned an invalid access response.");
  }
  return { ebUserId: body.ebUserId, orderId: body.orderId };
}
