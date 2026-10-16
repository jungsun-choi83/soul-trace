export const VISUAL_MEMORY_GENERATION_COOKIE = "soul-trace-vm-generation";

export function visualMemoryGenerationUsed(cookieHeader: string | null): boolean {
  return (cookieHeader ?? "")
    .split(";")
    .some((part) => part.trim() === `${VISUAL_MEMORY_GENERATION_COOKIE}=1`);
}

export function visualMemoryGenerationCookie(secure: boolean): string {
  return [
    `${VISUAL_MEMORY_GENERATION_COOKIE}=1`,
    "Path=/",
    "Max-Age=31536000",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}
