"use client";

import type { CSSProperties } from "react";

type Particle = {
  tint: 0 | 1 | 2;
  style: CSSProperties;
};

/** 결정적 난수 — SSR/클라이언트 동일, 하이드레이션 안전 */
function frac(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}

function buildParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const r = (k: number) => frac(i * 17 + k * 31);
    const delay = r(0) * 6.5;
    const duration = 9.5 + r(1) * 10;
    const x0 = (r(2) - 0.5) * 7;
    const x1 = (r(3) - 0.5) * 46;
    const y1 = -(88 + r(4) * 38);
    const op = 0.3 + r(5) * 0.38;
    const s0 = 0.22 + r(6) * 0.42;
    const w = 3.5 + r(7) * 11;
    const h = w * (0.78 + r(8) * 0.28);
    const tint = (i % 3) as 0 | 1 | 2;

    return {
      tint,
      style: {
        width: `${w.toFixed(2)}px`,
        height: `${h.toFixed(2)}px`,
        animationDelay: `${delay.toFixed(2)}s`,
        animationDuration: `${duration.toFixed(2)}s`,
        ["--x0" as string]: `${x0.toFixed(2)}vw`,
        ["--x1" as string]: `${x1.toFixed(2)}vw`,
        ["--y1" as string]: `${y1.toFixed(2)}vh`,
        ["--op" as string]: op.toFixed(3),
        ["--s0" as string]: s0.toFixed(3),
      },
    };
  });
}

const PARTICLES = buildParticles(34);

const tintClass: Record<0 | 1 | 2, string> = {
  0: "warm-sparkle-particle--gold",
  1: "warm-sparkle-particle--pink",
  2: "warm-sparkle-particle--lavender",
};

/**
 * 랜딩 전용: 화면 하단 중앙에서 올라오며 퍼지는 은은한 보케 스파클.
 * pointer-events none, 콘텐츠보다 낮은 z-index로 배치할 것.
 */
export function WarmRisingSparkles() {
  return (
    <div className="warm-sparkle-field" aria-hidden>
      {PARTICLES.map((p, i) => (
        <span key={i} className="warm-sparkle-anchor">
          <span className={`warm-sparkle-particle ${tintClass[p.tint]}`} style={p.style} />
        </span>
      ))}
    </div>
  );
}
