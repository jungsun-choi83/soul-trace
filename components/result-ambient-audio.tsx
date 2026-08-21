"use client";

import { useLocale } from "@/components/locale-provider";
import { PRIME_BGM_VOLUME, resolveResultBgmSrc } from "@/lib/result-bgm";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type ResultAmbientAudioProps = {
  /** 결과 화면에서 로딩이 아닐 때(언어 전환 로딩 중엔 UI만 숨김, 오디오는 끊지 않음) */
  active: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
};

const VOL_END = 0.27;
const FADE_MS = 9000;

function sameSrc(current: string, want: string): boolean {
  if (!current.trim()) return false;
  try {
    return new URL(current, window.location.href).href === new URL(want, window.location.href).href;
  } catch {
    return false;
  }
}

export function ResultAmbientAudio({ active, audioRef }: ResultAmbientAudioProps) {
  const { t, lang } = useLocale();
  const src = resolveResultBgmSrc();
  const fadeRaf = useRef<number>(0);
  const fadeStart = useRef<number>(0);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const font = lang === "ko" ? "font-ko" : "font-display-en";

  useEffect(() => {
    const el = audioRef.current;
    return () => {
      if (!el) return;
      el.pause();
      el.currentTime = 0;
    };
  }, [audioRef]);

  // muted 의 주인은 <audio> 다 — 여기서는 따라 읽기만 한다. 그래야 재생 시작,
  // 버튼 토글, 언어 전환 어느 경로로 바뀌든 라벨이 항상 실제 상태를 가리킨다.
  // 페이드가 매 프레임 volume 을 건드려 volumechange 가 쏟아지므로,
  // 값이 그대로면 같은 값을 돌려보내 리렌더를 막는다.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const sync = () => setMuted((prev) => (prev === el.muted ? prev : el.muted));
    el.addEventListener("volumechange", sync);
    return () => el.removeEventListener("volumechange", sync);
  }, [audioRef]);

  useEffect(() => {
    if (!active) return;
    const el = audioRef.current;
    if (!el) return;

    if (!sameSrc(el.src, src)) {
      el.src = src;
    }
    el.loop = true;
    el.muted = false;

    const fromVol = Math.min(Math.max(el.volume, PRIME_BGM_VOLUME * 0.5), VOL_END - 0.02);
    el.volume = fromVol;
    fadeStart.current = 0;
    cancelAnimationFrame(fadeRaf.current);

    const runFade = () => {
      const tick = (now: number) => {
        if (!fadeStart.current) fadeStart.current = now;
        const t = Math.min(1, (now - fadeStart.current) / FADE_MS);
        const ease = 1 - (1 - t) * (1 - t);
        if (!el.muted) {
          el.volume = fromVol + (VOL_END - fromVol) * ease;
        }
        if (t < 1) {
          fadeRaf.current = requestAnimationFrame(tick);
        }
      };
      fadeRaf.current = requestAnimationFrame(tick);
    };

    const tryPlay = async () => {
      try {
        await el.play();
        setPlaying(true);
        setNeedsTap(false);
        runFade();
      } catch {
        setPlaying(false);
        setNeedsTap(true);
      }
    };

    void tryPlay();

    return () => {
      cancelAnimationFrame(fadeRaf.current);
      fadeStart.current = 0;
    };
  }, [active, audioRef, src]);

  const onBottomClick = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;

    if (needsTap || !playing) {
      try {
        if (!sameSrc(el.src, src)) el.src = src;
        el.loop = true;
        el.muted = false;
        el.volume = PRIME_BGM_VOLUME;
        fadeStart.current = 0;
        cancelAnimationFrame(fadeRaf.current);
        await el.play();
        setPlaying(true);
        setNeedsTap(false);
        const fromVol = el.volume;
        const tick = (now: number) => {
          if (!fadeStart.current) fadeStart.current = now;
          const t = Math.min(1, (now - fadeStart.current) / FADE_MS);
          const ease = 1 - (1 - t) * (1 - t);
          if (!el.muted) el.volume = fromVol + (VOL_END - fromVol) * ease;
          if (t < 1) fadeRaf.current = requestAnimationFrame(tick);
        };
        fadeRaf.current = requestAnimationFrame(tick);
      } catch {
        setNeedsTap(true);
      }
      return;
    }

    el.muted = !el.muted;
  }, [needsTap, playing, audioRef, src]);

  if (!active) return null;

  const label = needsTap
    ? t("result.bgmTapToPlay")
    : muted
      ? t("result.bgmUnmute")
      : t("result.bgmMute");

  return (
    <button
      type="button"
      onClick={() => void onBottomClick()}
      className={`fixed bottom-5 right-4 z-[450] rounded-full border border-[rgba(212,175,55,0.45)] bg-[rgba(8,8,8,0.72)] px-3.5 py-2 text-[11px] font-extralight text-[#E8DCC8] shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm transition hover:bg-[rgba(212,175,55,0.1)] sm:bottom-6 sm:right-6 sm:text-xs ${font}`}
      aria-pressed={playing && !muted}
      aria-label={label}
    >
      {label}
    </button>
  );
}
