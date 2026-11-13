import type OpenAI from "openai";

import type { FreeStyle } from "./pet-free-trial.ts";
import {
  generatePetReferenceImage,
  type PetImageReference,
  type VisualMemoryImageGenerationResult,
} from "./visual-memory-ai.ts";

export const TRIAL_THEME_IDS = [
  "christmas-village",
  "spring-picnic",
  "summer-beach",
  "autumn-walk",
  "birthday-room",
  "first-snow-street",
] as const;

export type TrialThemeId = (typeof TRIAL_THEME_IDS)[number];

export type TrialPlatePreset = {
  themeId: TrialThemeId;
  petAnchorX: number;
  petAnchorY: number;
  petMaxWidth: number;
  petMaxHeight: number;
  foregroundOverlay: null;
  ground: string;
  snowContact: boolean;
  sceneComposition: string;
};

/** Approximate placement in the open scene area. Fractions of the frame, not pixels. */
export const TRIAL_PLATE_PRESETS: Record<TrialThemeId, TrialPlatePreset> = {
  "christmas-village": { themeId: "christmas-village", petAnchorX: 0.5, petAnchorY: 0.74, petMaxWidth: 0.34, petMaxHeight: 0.52, foregroundOverlay: null, ground: "the snowy village path", snowContact: true, sceneComposition: "Choose a relaxed walk or pause on the open village path; angle the body along the path and let the pet glance toward a warmly lit shop or decorated tree. Keep the village windows and central buildings visible." },
  "spring-picnic": { themeId: "spring-picnic", petAnchorX: 0.5, petAnchorY: 0.72, petMaxWidth: 0.34, petMaxHeight: 0.5, foregroundOverlay: null, ground: "the picnic meadow", snowContact: false, sceneComposition: "Place the pet in the open meadow near the picnic clearing, with a natural sit, stand, or gentle walk among the flowers. It may look toward the blossoms or picnic basket; keep the blanket, basket, and tent visible, and keep paws off the food." },
  "summer-beach": { themeId: "summer-beach", petAnchorX: 0.5, petAnchorY: 0.7, petMaxWidth: 0.36, petMaxHeight: 0.5, foregroundOverlay: null, ground: "the dry sandy beach", snowContact: false, sceneComposition: "Set the pet on dry sand in a comfortable standing, seated, or shoreline-walking pose. It may look toward the waves or distant lighthouse; keep it out of the water and leave the lighthouse and beach chairs unobstructed." },
  "autumn-walk": { themeId: "autumn-walk", petAnchorX: 0.5, petAnchorY: 0.73, petMaxWidth: 0.32, petMaxHeight: 0.52, foregroundOverlay: null, ground: "the leaf-strewn autumn path", snowContact: false, sceneComposition: "Compose the pet strolling along the path or pausing naturally beside it, with its body turned down the path or toward the lake and falling leaves. Keep the bench, fence, and lakeside view visible." },
  "birthday-room": { themeId: "birthday-room", petAnchorX: 0.5, petAnchorY: 0.7, petMaxWidth: 0.34, petMaxHeight: 0.5, foregroundOverlay: null, ground: "the open party-room floor", snowContact: false, sceneComposition: "Use a calm seated or standing pose on the open floor, with the pet naturally looking toward the birthday cake or decorations. Keep the cake, gift table, and room details clear; do not place paws on the table or cake." },
  "first-snow-street": { themeId: "first-snow-street", petAnchorX: 0.5, petAnchorY: 0.74, petMaxWidth: 0.32, petMaxHeight: 0.52, foregroundOverlay: null, ground: "the snowy street path", snowContact: true, sceneComposition: "Choose a gentle walk through the snow or a quiet seated pause on the open street. The pet may turn toward a warm window or lantern, with its body following the street's perspective; keep the storefronts and street details visible." },
};

const STYLE_BRIEF: Record<FreeStyle, string> = {
  "gouache-story": [
    "MEDIUM: hand-painted gouache. Soft but clear brushstrokes, opaque paint, the same color temperature and shadow handling as the background illustration.",
    "Redraw the pet with visible gouache paint. Do not leave any photographic fur, flash, or camera texture.",
  ].join("\n"),
  "felt-doll": [
    "MEDIUM: needle-felted wool. Visible wool fibers, soft handmade volume, a craft miniature that matches the felt background's scale and perspective.",
    "Do not render a plastic toy, a 3D animated character, or a photograph.",
  ].join("\n"),
  "crayon-diary": [
    "MEDIUM: the background's pastel vintage travel-poster illustration. Crisp delicate outlines, restrained pastel color, flat color with refined shading.",
    "No watercolor bleed, no anime, no photographic texture. The pet is drawn in that same poster style.",
  ].join("\n"),
};

export function isTrialTheme(value: string): value is TrialThemeId {
  return (TRIAL_THEME_IDS as readonly string[]).includes(value);
}

export function buildTrialPolaroidPrompt(style: FreeStyle, theme: TrialThemeId): string {
  const preset = TRIAL_PLATE_PRESETS[theme];
  const width = Math.round(preset.petMaxWidth * 100);
  const height = Math.round(preset.petMaxHeight * 100);
  const down = Math.round(preset.petAnchorY * 100);
  return [
    "Create one finished illustration. The first image is the real pet and is only an identity reference. The second image is the finished background and must stay the background.",
    "The pet and the background must look like one illustration in the same medium. A cutout photograph pasted onto the artwork is forbidden. Do not place a rectangle, frame, or photo edge around the pet. Do not cut a hole or a black region out of the background.",
    STYLE_BRIEF[style],
    "Keep the background artwork itself: the same buildings, trees, path, decorations, and framing. Do not redraw the scene, do not move the buildings, and do not add text, letters, a border, or a polaroid frame.",
    `Read the visible background and compose the pet on ${preset.ground}. ${preset.sceneComposition} Keep it near the open center area (around x ${Math.round(preset.petAnchorX * 100)}%, with paws around y ${down}%), allowing a modest shift within the open ground when that creates a more natural composition.`,
    "Choose one species-appropriate pose that fits this scene: sitting, standing, walking, or pausing to look toward a relevant background element. Do not copy the reference photo's pose or body orientation. Do not force the pet to face the camera; a natural side or three-quarter view is welcome when it suits the scene, while keeping enough of the face visible to preserve identity.",
    `The full pet must be visible: head, ears, tail, and paws are not cropped. Fit the pet inside about ${width}% of the frame width and ${height}% of the frame height, scaled to the scene's perspective. A small pet stays smaller; a large pet may be larger, but it must not cover important background elements.`,
    "Keep the posture anatomically natural for this individual pet, with paws or body visibly supported by the ground. Add a soft contact shadow that matches the background light. Match the background's perspective and color temperature.",
    preset.snowContact ? "This is a snowy path. Add a light natural snow contact around the paws. Do not bury the pet." : "Do not add snow.",
    "Preserve this individual pet: breed and build, coat colors and markings, ear shape, eye and nose character, face, body proportions, and a collar or other clear accessory if the photo shows one.",
    "Do not swap the breed, invent a smile, add a hat, or add a costume. No Christmas outfit unless it is already in the photo.",
    "Identity matters more than cuteness. The result is the same pet, redrawn into the background, not a different cute animal and not the original photo laid on top.",
    "FINAL CHECK: Fur, eyes, nose, ears, paws, and any leash must be drawn with the same marks as the background. A photographic animal standing inside an illustration is a failed image. Repaint the whole pet in that medium until no camera texture remains.",
  ].join("\n");
}

export async function generateTrialPolaroidImage({
  openai,
  pet,
  plate,
  style,
  theme,
}: {
  openai: OpenAI;
  pet: PetImageReference;
  plate: PetImageReference;
  style: FreeStyle;
  theme: TrialThemeId;
}): Promise<VisualMemoryImageGenerationResult> {
  return generatePetReferenceImage({
    openai,
    references: [pet, plate],
    prompt: buildTrialPolaroidPrompt(style, theme),
    size: "1536x1024",
    quality: "high",
    logLabel: "trial-polaroid",
  });
}
