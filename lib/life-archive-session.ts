export const ACTIVE_SUBMISSION_COOKIE = "soul-trace-active-submission";
export const PENDING_LETTER_COOKIE = "soul-trace-pending-letter";
export const ACTIVE_SUBMISSION_MAX_AGE = 60 * 60 * 24 * 365;

export function lifeArchiveCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
