"use client";

import { createSupabaseBrowserAuthClient } from "@/lib/supabase-auth-browser";
import { useCallback, useEffect, useState } from "react";

export type AuthSessionState = {
  status: "loading" | "authenticated" | "anonymous";
  email: string | null;
  refresh: () => Promise<"loading" | "authenticated" | "anonymous">;
};

export function useAuthSession(): AuthSessionState {
  const [status, setStatus] = useState<AuthSessionState["status"]>("loading");
  const [email, setEmail] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const client = createSupabaseBrowserAuthClient();
      const user = await Promise.race([
        client.auth.getUser().then(({ data }) => data.user ?? null),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 5000)),
      ]);
      const nextStatus = user ? "authenticated" : "anonymous";
      setEmail(user?.email ?? null);
      setStatus(nextStatus);
      return nextStatus;
    } catch {
      setEmail(null);
      setStatus("anonymous");
      return "anonymous" as const;
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const client = createSupabaseBrowserAuthClient();
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "TOKEN_REFRESHED") return;
        setEmail(session?.user.email ?? null);
        setStatus(session?.user ? "authenticated" : "anonymous");
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // The scheduled refresh below owns the initial failure fallback.
    }
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [refresh]);

  return { status, email, refresh };
}
