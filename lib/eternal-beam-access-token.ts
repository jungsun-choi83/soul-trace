import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type EternalBeamAccessSource = "eternal_beam" | "development";

type AccessClaims = {
  v: 1;
  purpose: "life_archive";
  source: EternalBeamAccessSource;
  exp: number;
  nonce: string;
};

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createSignedAccessToken(
  secret: string,
  source: EternalBeamAccessSource,
  maxAgeSeconds: number,
  now = Date.now(),
): string {
  if (!secret) throw new Error("A session secret is required.");
  const claims: AccessClaims = {
    v: 1,
    purpose: "life_archive",
    source,
    exp: Math.floor(now / 1000) + maxAgeSeconds,
    nonce: randomBytes(16).toString("base64url"),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySignedAccessToken(value: string | null | undefined, secret: string, now = Date.now()): boolean {
  if (!secret || !value) return false;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return false;
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AccessClaims>;
    return claims.v === 1 && claims.purpose === "life_archive" &&
      (claims.source === "eternal_beam" || claims.source === "development") &&
      typeof claims.exp === "number" && claims.exp > Math.floor(now / 1000) &&
      typeof claims.nonce === "string" && claims.nonce.length >= 16;
  } catch {
    return false;
  }
}
