import { CLEAN_ART, cleanArtSize } from "@/lib/design-art";
import Image from "next/image";
import type { ReactNode } from "react";

/** Clean original illustrations only. Composites with status bars or baked UI copy are excluded. */
export const STORY_SCENES = {
  splash: CLEAN_ART.livingHero,
  home: CLEAN_ART.livingHero,
  livingroom: CLEAN_ART.livingHero,
  timeline: CLEAN_ART.walk,
  letter: CLEAN_ART.running,
  memorial: CLEAN_ART.nightWindow,
  monthly: CLEAN_ART.walk,
  portrait: CLEAN_ART.running,
  bloom: CLEAN_ART.livingHero,
} as const;

export type StorySceneName = keyof typeof STORY_SCENES;

export function StoryScene({
  scene,
  priority = false,
  fade = false,
  className = "",
  children,
}: {
  scene: StorySceneName;
  priority?: boolean;
  fade?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const src = STORY_SCENES[scene];
  const size = cleanArtSize(src);
  return (
    <div className={`st-scene ${className}`}>
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        width={size.width}
        height={size.height}
        priority={priority}
        quality={90}
        sizes="(max-width: 600px) 100vw, 480px"
        className="pointer-events-none block h-auto w-full select-none object-contain"
      />
      {fade ? <div className="st-scene-fade" aria-hidden="true" /> : null}
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}
