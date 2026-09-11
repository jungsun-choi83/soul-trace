"use client";

import { useId } from "react";

type LetterPostageStampProps = {
  photoUrl: string | null;
  accentColor: string;
  inkColor: string;
};

export function LetterPostageStamp({ photoUrl, accentColor, inkColor }: LetterPostageStampProps) {
  const maskId = `stamp-mask-${useId().replace(/:/g, "")}`;
  const textureId = `${maskId}-texture`;
  const pawInkId = `${maskId}-paw-ink`;

  return (
    <div
      data-letter-postage-stamp={photoUrl ? "photo" : "paw"}
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
          <filter id={pawInkId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.08" numOctaves="2" seed="9" result="inkNoise" />
            <feDisplacementMap in="SourceGraphic" in2="inkNoise" scale="1.35" xChannelSelector="R" yChannelSelector="G" />
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
            <g transform="translate(70 22) rotate(-7 24 30)" fill={accentColor} filter={`url(#${pawInkId})`}>
              <path d="M9.5 39.5c1.1-8.2 7.9-15.8 15.8-16.2 8.8-.5 17 7.1 18.1 15.2.8 5.7-3.7 10.2-9.4 9.7-3.7-.3-5.1-2.6-8.7-2.5-3.4.1-5 2.7-8.7 2.7-4.8 0-7.8-3.8-7.1-8.9Z" />
              <ellipse cx="5.8" cy="21.2" rx="5.8" ry="8.2" transform="rotate(-29 5.8 21.2)" />
              <ellipse cx="17.3" cy="10.7" rx="5.9" ry="8.6" transform="rotate(-10 17.3 10.7)" />
              <ellipse cx="31.1" cy="9.7" rx="5.8" ry="8.5" transform="rotate(8 31.1 9.7)" />
              <ellipse cx="43.1" cy="19.2" rx="5.7" ry="8.1" transform="rotate(29 43.1 19.2)" />
              <path d="M16 38c3.5-3.4 6.3-4.8 10.3-4.8 4.2 0 7.3 1.3 11 4.5" fill="none" stroke="#fff5df" strokeWidth="0.75" opacity="0.22" />
            </g>
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
