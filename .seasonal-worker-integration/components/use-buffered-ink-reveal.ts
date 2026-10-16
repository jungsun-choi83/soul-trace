"use client";

import {
  bufferedWordDelayMs,
  completeStreamedLetterPrefix,
  revealUnits,
  shouldStartBufferedReveal,
} from "@/lib/ink-word-reveal";
import { useEffect, useMemo, useRef, useState } from "react";

type BufferedInkRevealOptions = {
  streamedText: string;
  finalText: string;
  active: boolean;
  generationComplete: boolean;
  onRevealStart?: () => void;
};

export function useBufferedInkReveal({
  streamedText,
  finalText,
  active,
  generationComplete,
  onRevealStart,
}: BufferedInkRevealOptions): { visibleText: string; revealComplete: boolean } {
  const availableText = generationComplete
    ? finalText
    : completeStreamedLetterPrefix(streamedText);
  const units = useMemo(() => revealUnits(availableText), [availableText]);
  const [visibleCount, setVisibleCount] = useState(active ? 0 : units.length);
  const startedRef = useRef(false);

  const streamedUnits = useMemo(
    () => revealUnits(completeStreamedLetterPrefix(streamedText)),
    [streamedText],
  );
  const releasedStreamedText = streamedUnits.slice(0, visibleCount).join("").trimEnd();
  const finalCompatible = !generationComplete || finalText.startsWith(releasedStreamedText);
  const effectiveVisibleCount = finalCompatible ? Math.min(visibleCount, units.length) : 0;
  const visibleText = units.slice(0, effectiveVisibleCount).join("");

  useEffect(() => {
    if (!active) return;
    if ((!generationComplete && streamedText === "") || !finalCompatible) {
      const resetTimer = window.setTimeout(() => {
        setVisibleCount(0);
        startedRef.current = false;
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    if (!shouldStartBufferedReveal(availableText, generationComplete)) return;
    if (visibleCount >= units.length) return;

    const delay = visibleCount === 0
      ? 0
      : bufferedWordDelayMs(units[visibleCount - 1]?.trim() ?? "", visibleCount - 1, units.length);
    const timer = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 1, units.length));
      if (!startedRef.current) {
        startedRef.current = true;
        onRevealStart?.();
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    active,
    availableText,
    finalCompatible,
    generationComplete,
    onRevealStart,
    streamedText,
    units,
    visibleCount,
  ]);

  return {
    visibleText: active ? visibleText : finalText,
    revealComplete: !active || (generationComplete && effectiveVisibleCount >= units.length),
  };
}
