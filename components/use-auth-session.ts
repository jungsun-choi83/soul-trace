"use client";

import { createSupabaseBrowserAuthClient } from "@/lib/supabase-auth-browser";
import { useCallback, useEffect, useState } from "react";

export type AuthSessionState = {
  status: "loading" | "authenticated" | "anonymous";
  email: string | null;
  refresh: () => Promise<void>;
};

export function useAuthSession(): AuthSessionState {
  const [status, setStatus] = useState<AuthSessionState["status"]>("loading");
  const [email, setEmail] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const client = createSupabaseBrowserAuthClient();
      const { data } = await client.auth.getUser();
      setEmail(data.user?.email ?? null);
      setStatus(data.user ? "authenticated" : "anonymous");
    } catch {
      setEmail(null);
      setStatus("anonymous");
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
      setStatus("anonymous");
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
