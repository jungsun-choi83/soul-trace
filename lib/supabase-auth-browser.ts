import { createBrowserClient } from "@supabase/ssr";

function getPublicSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function createSupabaseBrowserAuthClient() {
  const config = getPublicSupabaseConfig();
  if (!config) {
    throw new Error("Supabase browser authentication is not configured.");
  }

  return createBrowserClient(config.url, config.key);
}
