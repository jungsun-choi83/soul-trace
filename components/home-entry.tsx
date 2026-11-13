"use client";

import { SplashScreen } from "@/components/splash-screen";
import {
  markSplashSeen,
  splashAlreadySeen,
  SPLASH_FADE_MS,
  SPLASH_HOLD_MS,
} from "@/lib/splash-entry";
import { type ReactNode, useCallback, useEffect, useState } from "react";

type SplashPhase = "pending" | "splash" | "leaving" | "home";

export function HomeEntry({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SplashPhase>("pending");

  const finish = useCallback(() => {
    markSplashSeen(window.sessionStorage);
    setPhase((current) => (current === "home" || current === "leaving" ? current : "leaving"));
  }, []);

  useEffect(() => {
    const replay = new URLSearchParams(window.location.search).get("splash") === "1";
    if (!replay && splashAlreadySeen(window.sessionStorage)) {
      setPhase("home");
      return;
    }
    if (replay) {
      try {
        window.history.replaceState(null, "", "/");
      } catch {
        // Showing splash still works if the query cannot be stripped.
      }
    }
    const startedKey = "soultrace.splash.started";
    let started = Number(window.sessionStorage.getItem(startedKey));
    if (!Number.isFinite(started) || started <= 0) {
      started = Date.now();
      try {
        window.sessionStorage.setItem(startedKey, String(started));
      } catch {
        // The timer still runs for this mount.
      }
    }
    setPhase("splash");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reducedMotion ? 280 : SPLASH_HOLD_MS;
    const id = window.setTimeout(finish, Math.max(0, hold - (Date.now() - started)));
    return () => window.clearTimeout(id);
  }, [finish]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setPhase("home"), reducedMotion ? 0 : SPLASH_FADE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "pending" && phase !== "splash") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, phase]);

  const splashVisible = phase === "pending" || phase === "splash" || phase === "leaving";

  return (
    <>
      <div aria-hidden={splashVisible}>{children}</div>
      {splashVisible ? (
        <SplashScreen fading={phase === "leaving"} onDismiss={finish} />
      ) : null}
    </>
  );
}
