import type { CSSProperties } from "react";
import type { InkRevealToken } from "@/lib/ink-word-reveal";
import styles from "./ink-word-reveal.module.css";

type InkWordRevealProps = {
  tokens: readonly InkRevealToken[];
  animate: boolean;
  live?: boolean;
};

type InkStyle = CSSProperties & {
  "--ink-delay": string;
  "--ink-duration": string;
};

export function InkWordReveal({ tokens, animate, live = false }: InkWordRevealProps) {
  return tokens.map((token, index) => {
    if (!token.isWord) return token.text;
    const style: InkStyle = {
      "--ink-delay": `${live ? 0 : token.delayMs}ms`,
      "--ink-duration": `${live ? 170 : token.durationMs}ms`,
    };
    return (
      <span
        key={`${index}-${token.text}`}
        className={`${styles.word} ${animate ? styles.animated : ""}`}
        style={style}
      >
        {token.text}
      </span>
    );
  });
}
