import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseServerConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export function createSupabaseServerClient(): SupabaseClient | null {
  const cfg = getSupabaseServerConfig();
  if (!cfg) return null;
  return createClient(cfg.url, cfg.key, {
    auth: { persistSession: false },
  });
}

export function isRetryableSupabaseMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("econnreset") ||
    m.includes("socket") ||
    m.includes("503") ||
    m.includes("502")
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
