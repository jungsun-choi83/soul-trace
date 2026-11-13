export const SPLASH_ART_SRC = "/images/poses/shiba-autumn.jpg";
export const SPLASH_SESSION_KEY = "soultrace.splash.seen";
export const SPLASH_HOLD_MS = 1100;
export const SPLASH_FADE_MS = 400;

export function splashAlreadySeen(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(SPLASH_SESSION_KEY) === "1";
  } catch {
    return true;
  }
}

export function markSplashSeen(storage: Pick<Storage, "setItem"> | null | undefined): void {
  try {
    storage?.setItem(SPLASH_SESSION_KEY, "1");
  } catch {
    // Private mode or blocked storage should not hold the visitor on splash.
  }
}
