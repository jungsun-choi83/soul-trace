import { POSE_ART, poseSize } from "@/lib/pose-art";
import Image from "next/image";
import type { ReactNode } from "react";

/** Demo pose illustrations. Owner-uploaded photos stay on their own image tags. */
export const STORY_SCENES = {
  splash: POSE_ART.shibaAutumn,
  home: POSE_ART.shibaHome,
  livingroom: POSE_ART.shibaHome,
  timeline: POSE_ART.corgiAutumn,
  letter: POSE_ART.shibaSpring,
  memorial: POSE_ART.shibaAutumn,
  monthly: POSE_ART.shibaSpring,
  portrait: POSE_ART.shibaSpring,
  bloom: POSE_ART.corgiSpring,
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
  const size = poseSize(src);
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
