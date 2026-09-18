"use client";

import { useId } from "react";
import type { DefaultStampType } from "@/lib/stamp";

type LetterPostageStampProps = {
  photoUrl: string | null;
  defaultStamp: DefaultStampType;
  accentColor: string;
  inkColor: string;
};

export function LetterPostageStamp({ photoUrl, defaultStamp, accentColor, inkColor }: LetterPostageStampProps) {
  const maskId = `stamp-mask-${useId().replace(/:/g, "")}`;
  const textureId = `${maskId}-texture`;

  return (
    <div
      data-letter-postage-stamp={photoUrl ? "photo" : `paw-${defaultStamp}`}
      className="pointer-events-none absolute right-3 top-3 h-[110px] w-[150px] sm:right-6 sm:top-5 sm:h-[140px] sm:w-[190px]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 148 112" className="h-full w-full overflow-visible">
        <defs>
          <mask id={maskId}>
            <rect x="51" y="5" width="87" height="91" rx="3" fill="white" />
            {Array.from({ length: 10 }, (_, index) => (
              <circle key={`top-${index}`} cx={55 + index * 8.8} cy="5" r="2.2" fill="black" />
            ))}
            {Array.from({ length: 10 }, (_, index) => (
              <circle key={`bottom-${index}`} cx={55 + index * 8.8} cy="96" r="2.2" fill="black" />
            ))}
            {Array.from({ length: 11 }, (_, index) => (
              <circle key={`left-${index}`} cx="51" cy={8 + index * 8.5} r="2.2" fill="black" />
            ))}
            {Array.from({ length: 11 }, (_, index) => (
              <circle key={`right-${index}`} cx="138" cy={8 + index * 8.5} r="2.2" fill="black" />
            ))}
          </mask>
          <linearGradient id={`${maskId}-paper`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="0.52" stopColor="#f4e5c8" />
            <stop offset="1" stopColor="#ddc292" />
          </linearGradient>
          <filter id={textureId} x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="3" seed="17" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="paperNoise" />
            <feBlend in="SourceGraphic" in2="paperNoise" mode="multiply" />
          </filter>
        </defs>

        <g mask={`url(#${maskId})`}>
          <rect x="49" y="3" width="91" height="95" fill={`url(#${maskId}-paper)`} filter={`url(#${textureId})`} />
          <rect x="54" y="8" width="81" height="82" fill="none" stroke={accentColor} strokeWidth="0.75" opacity="0.58" />
          {photoUrl ? (
            <image
              href={photoUrl}
              x="57"
              y="11"
              width="75"
              height="75"
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <image
              href={`/images/stamps/${defaultStamp}.png`}
              x="62"
              y="15"
              width="65"
              height="65"
              preserveAspectRatio="xMidYMid meet"
              opacity="0.9"
            />
          )}
          <rect x="57" y="11" width="75" height="75" fill="none" stroke={accentColor} strokeWidth="1.15" opacity="0.86" />
          <text x="94.5" y="92" textAnchor="middle" fontSize="5.5" letterSpacing="1.6" fill={inkColor}>
            SOUL TRACE
          </text>
        </g>

        <g fill="none" stroke={inkColor} strokeWidth="1.1" opacity="0.66">
          <circle cx="48" cy="52" r="24" />
          <circle cx="48" cy="52" r="20" />
          <path d="M25 48c16-2 31-1 49 1M27 54c17-1 32 0 49 2M30 60c15 0 29 1 45 3" />
          <path d="M24 43c14-5 31-5 50 1" />
        </g>
        <text x="48" y="36" textAnchor="middle" fontSize="5" letterSpacing="1.3" fill={inkColor} opacity="0.78">
          SOUL TRACE
        </text>
        <text x="48" y="72" textAnchor="middle" fontSize="4.2" letterSpacing="0.8" fill={inkColor} opacity="0.78">
          WITH LOVE
        </text>
      </svg>
    </div>
  );
}
