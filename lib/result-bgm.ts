import type { RefObject } from "react";

export const DEFAULT_RESULT_BGM = "/audio/result-ambient.mp3";

export function resolveResultBgmSrc(): string {
  const env =
    typeof process.env.NEXT_PUBLIC_RESULT_BGM_URL === "string"
      ? process.env.NEXT_PUBLIC_RESULT_BGM_URL.trim()
      : "";
  return env.length > 0 ? env : DEFAULT_RESULT_BGM;
}

/** 생성 대기 중에도 들리도록 아주 낮은 볼륨으로 유지 */
export const PRIME_BGM_VOLUME = 0.06;

/**
 * 편지 확인 버튼 클릭 직후 — 사용자 제스처로 `play()` 허용 + 대기(수십 초) 동안 잔잔히 재생.
 * 결과 화면에서 같은 `<audio>`로 볼륨만 키워 이어감.
 */
export async function primeResultBgm(audioRef: RefObject<HTMLAudioElement | null>): Promise<void> {
  if (typeof window === "undefined") return;
  const el = audioRef.current;
  if (!el) return;

  const src = resolveResultBgmSrc();
  el.src = src;
  el.loop = true;
  el.muted = false;
  el.volume = PRIME_BGM_VOLUME;

  try {
    await el.play();
  } catch {
    /* 브라우저 정책 등 — 결과 화면에서 다시 시도 */
  }
}

export function stopResultBgm(audioRef: RefObject<HTMLAudioElement | null>): void {
  const el = audioRef.current;
  if (!el) return;
  el.pause();
  el.currentTime = 0;
}
